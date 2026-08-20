import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EscalationService } from '../authz/escalation.service';
import {
  cargoEsValido,
  type NivelSolicitud,
} from '../catalogo-cargos/catalogo-cargos';
import {
  AppBadRequestException,
  AppConflictException,
  AppNotFoundException,
} from '../common';
import { D } from '../domain';
import { K } from '../i18n';
import {
  EMAIL_NOTIFIER,
  type EmailNotifier,
} from '../email/email-notifier.port';
import { Notificador } from '../notificaciones/notificador.port';
import { Role } from '../roles/role.entity';
import { SiscoutSnapshotService } from '../siscout/siscout-snapshot.service';
import {
  User,
  type EstadoAcceso,
  type NivelAcceso,
} from '../users/user.entity';
import type { CrearSolicitudDto } from './dto/crear-solicitud.dto';
import type {
  AprobarSolicitudDto,
  RechazarSolicitudDto,
} from './dto/resolver-solicitud.dto';
import { SolicitudAcceso } from './solicitud-acceso.entity';
import { resolverTerritorio } from './territorio';

@Injectable()
export class SolicitudesAccesoService {
  constructor(
    @InjectRepository(SolicitudAcceso)
    private readonly solicitudes: Repository<SolicitudAcceso>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    private readonly notificador: Notificador,
    private readonly snapshots: SiscoutSnapshotService,
    @Inject(EMAIL_NOTIFIER)
    private readonly email: EmailNotifier,
    private readonly escalation: EscalationService,
  ) {}

  private readonly logger = new Logger(SolicitudesAccesoService.name);

  private nombreTerritorio(
    nivel: NivelSolicitud,
    snapshot: Record<string, unknown> | null,
  ): string | null {
    if (
      nivel === D.ROLE_LEVEL.GRUPO &&
      typeof snapshot?.group_name === 'string'
    ) {
      return snapshot.group_name;
    }
    if (
      nivel === D.ROLE_LEVEL.REGION &&
      typeof snapshot?.district_name === 'string'
    ) {
      return snapshot.district_name;
    }
    return null;
  }

  /** Resuelve destinatario (correo + nombre) desde el snapshot cifrado. */
  private async destinatario(
    idPersona: string,
  ): Promise<{ to: string; nombre: string } | null> {
    const persona = await this.users.findOne({ where: { id: idPersona } });
    if (!persona) return null;
    const snapshot = await this.snapshots.findDecrypted(persona.idSiscout);
    const to = typeof snapshot?.email === 'string' ? snapshot.email : null;
    return to ? { to, nombre: persona.name } : null;
  }

  private async enviarResolucion(
    idPersona: string,
    resultado: typeof D.ACCESS_STATE.APPROVED | typeof D.ACCESS_STATE.REJECTED,
    extra: { nivel?: NivelSolicitud; cargo?: string; nota?: string | null },
  ): Promise<void> {
    try {
      const dest = await this.destinatario(idPersona);
      if (!dest) return;
      await this.email.sendSolicitudResuelta({
        to: dest.to,
        nombre: dest.nombre,
        resultado,
        nivel: extra.nivel,
        cargo: extra.cargo,
        nota: extra.nota,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar el correo de resolución: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async crear(
    userId: string,
    dto: CrearSolicitudDto,
  ): Promise<SolicitudAcceso> {
    const persona = await this.users.findOne({ where: { id: userId } });

    if (!persona) {
      throw new AppNotFoundException(K.REQUESTS.AUTHENTICATED_PERSON_NOT_FOUND);
    }
    if (persona.estadoAcceso === D.ACCESS_STATE.APPROVED) {
      throw new AppConflictException(K.REQUESTS.ACCESS_ALREADY_APPROVED);
    }
    if (persona.estadoAcceso === D.ACCESS_STATE.SUSPENDED) {
      throw new AppConflictException(K.REQUESTS.ACCESS_SUSPENDED);
    }
    if (!cargoEsValido(dto.cargo, dto.nivel)) {
      throw new AppBadRequestException(K.REQUESTS.POSITION_LEVEL_MISMATCH);
    }

    const activa = await this.solicitudes.findOne({
      where: {
        idPersona: persona.id,
        estado: In([D.REQUEST_STATE.PENDING, D.REQUEST_STATE.IN_REVIEW]),
      },
    });
    if (activa) {
      throw new AppConflictException(K.REQUESTS.ALREADY_IN_PROGRESS);
    }

    const snapshot = await this.snapshots.findDecrypted(persona.idSiscout);
    const territorio = resolverTerritorio(dto.nivel, snapshot, {
      rama: dto.rama,
      groupId: dto.groupId,
      districtId: dto.districtId,
    });
    if ('error' in territorio) {
      throw new AppBadRequestException(territorio.error);
    }

    const solicitud = await this.solicitudes.save(
      this.solicitudes.create({
        idPersona: persona.id,
        nivelSolicitado: dto.nivel,
        cargoSolicitado: dto.cargo,
        telefonoContacto: dto.telefono,
        rama: territorio.rama,
        groupId: territorio.groupId,
        districtId: territorio.districtId,
        estado: D.REQUEST_STATE.PENDING,
      }),
    );

    await this.users.update(
      { id: persona.id },
      { estadoAcceso: D.ACCESS_STATE.PENDING },
    );

    await this.notificador.encolar({
      tipo: 'solicitud_recibida',
      destinatario: { personaId: persona.id },
      datos: { nivel: dto.nivel, cargo: dto.cargo },
    });

    const to = typeof snapshot?.email === 'string' ? snapshot.email : null;
    if (to) {
      try {
        await this.email.sendSolicitudRecibida({
          to,
          nombre: persona.name,
          nivel: dto.nivel,
          cargo: dto.cargo,
          territorioNombre: this.nombreTerritorio(dto.nivel, snapshot),
        });
      } catch (error) {
        this.logger.warn(
          `No se pudo enviar el correo de espera: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return solicitud;
  }

  async listarPendientes(): Promise<SolicitudAcceso[]> {
    return this.solicitudes.find({
      where: {
        estado: In([D.REQUEST_STATE.PENDING, D.REQUEST_STATE.IN_REVIEW]),
      },
      relations: { persona: true },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<SolicitudAcceso> {
    const solicitud = await this.solicitudes.findOne({
      where: { id },
      relations: { persona: true },
    });
    if (!solicitud) {
      throw new AppNotFoundException(K.REQUESTS.NOT_FOUND, { id });
    }
    return solicitud;
  }

  async contextoOnboarding(userId: string): Promise<{
    estadoAcceso: EstadoAcceso;
    nivelAcceso?: NivelAcceso;
    groupId: number | null;
    groupName: string | null;
    districtId: number | null;
    districtName: string | null;
    cargoSiscout: string | null;
  }> {
    const persona = await this.users.findOne({ where: { id: userId } });
    if (!persona) {
      throw new AppNotFoundException(K.REQUESTS.AUTHENTICATED_PERSON_NOT_FOUND);
    }

    // Territorio y cargo se leen del registro público: el sync los proyecta
    // desde la lista de permitidos, así que descifrar el snapshot para esto
    // sería pagar una lectura de la tabla privada por datos que no son PII.
    return {
      estadoAcceso: persona.estadoAcceso,
      nivelAcceso: persona.nivelAcceso ?? undefined,
      groupId: persona.groupId ?? null,
      groupName: persona.groupName ?? null,
      districtId: persona.districtId ?? null,
      districtName: persona.districtName ?? null,
      cargoSiscout: persona.cargoSiscout ?? null,
    };
  }

  /**
   * Aprueba una solicitud. Fija el `nivelAcceso` de la persona, que es
   * privilegio puro, así que el nivel aprobado se compara contra el de quien
   * aprueba: `solicitud:approve` dice que puede resolver la cola, no hasta
   * dónde puede llegar el nivel que concede.
   */
  async aprobar(
    actorId: string,
    id: string,
    dto: AprobarSolicitudDto,
  ): Promise<SolicitudAcceso> {
    const solicitud = await this.cargarResoluble(id);
    // El nivel efectivo, no solo `dto.nivel`: sin él se aprueba tal cual lo
    // pidió el solicitante, que es exactamente el mismo privilegio.
    const nivel = dto.nivel ?? solicitud.nivelSolicitado;
    const cargo = dto.cargo ?? solicitud.cargoSolicitado;

    await this.escalation.assertCanGrantLevel(actorId, nivel);

    if (!cargoEsValido(cargo, nivel)) {
      throw new AppBadRequestException(K.REQUESTS.POSITION_LEVEL_MISMATCH);
    }

    // Se valida ANTES de tocar nada: un 403 por roles no puede dejar a la
    // persona aprobada a medias.
    const rolesPorConceder = await this.rolesPorConceder(
      actorId,
      solicitud.idPersona,
      dto.roleIds ?? [],
    );

    await this.users.update(
      { id: solicitud.idPersona },
      { estadoAcceso: D.ACCESS_STATE.APPROVED, nivelAcceso: nivel },
    );

    if (rolesPorConceder.length > 0) {
      // `update()` no escribe relaciones; la tabla puente se toca aparte.
      await this.users
        .createQueryBuilder()
        .relation(User, 'roles')
        .of(solicitud.idPersona)
        .add(rolesPorConceder);
    }

    solicitud.estado = D.REQUEST_STATE.APPROVED;
    solicitud.nivelAprobado = nivel;
    solicitud.cargoAprobado = cargo;
    solicitud.notaAprobador = dto.nota ?? null;
    solicitud.resueltoEn = new Date();
    solicitud.aprobadoPor = actorId;
    await this.solicitudes.save(solicitud);

    await this.notificador.encolar({
      tipo: 'solicitud_resuelta',
      destinatario: { personaId: solicitud.idPersona },
      datos: { resultado: D.REQUEST_STATE.APPROVED, nivel, cargo },
    });

    await this.enviarResolucion(solicitud.idPersona, D.ACCESS_STATE.APPROVED, {
      nivel,
      cargo,
    });

    return solicitud;
  }

  /**
   * Roles que hay que añadir realmente, tras comprobar que existen y que el
   * aprobador puede concederlos.
   *
   * "Un rol de mi orden o inferior" se resuelve por CONTENIDO, no por jerarquía:
   * un rol es concedible si el aprobador ya tiene todo lo que ese rol otorga
   * —permisos y rutas, con comodines—. Por eso no hace falta un campo `nivel`
   * en `Role`: `assertCanGrantRoles` compara los conjuntos.
   *
   * Los que la persona YA tiene se pasan como `previous` y no como concesión:
   * reafirmar un rol existente no escala nada, y bloquearlo impediría aprobar
   * a alguien que ya lo traía de una aprobación anterior.
   */
  private async rolesPorConceder(
    actorId: string,
    personaId: string,
    roleIds: readonly string[],
  ): Promise<string[]> {
    if (roleIds.length === 0) return [];

    const existentes = await this.roles.find({
      where: { id: In([...roleIds]) },
      select: { id: true },
    });
    const encontrados = new Set(existentes.map((role) => role.id));
    const faltante = roleIds.find((id) => !encontrados.has(id));
    if (faltante) {
      throw new AppNotFoundException(K.ROLES.NOT_FOUND, { id: faltante });
    }

    const persona = await this.users.findOne({
      where: { id: personaId },
      relations: { roles: true },
    });
    const actuales = (persona?.roles ?? []).map((role) => role.id);

    await this.escalation.assertCanGrantRoles(actorId, actuales, [...roleIds]);

    const yaTiene = new Set(actuales);
    return roleIds.filter((id) => !yaTiene.has(id));
  }

  async rechazar(
    id: string,
    dto: RechazarSolicitudDto,
  ): Promise<SolicitudAcceso> {
    const solicitud = await this.cargarResoluble(id);

    await this.users.update(
      { id: solicitud.idPersona },
      { estadoAcceso: D.ACCESS_STATE.REJECTED },
    );

    solicitud.estado = D.REQUEST_STATE.REJECTED;
    solicitud.notaAprobador = dto.nota ?? null;
    solicitud.resueltoEn = new Date();
    await this.solicitudes.save(solicitud);

    await this.notificador.encolar({
      tipo: 'solicitud_resuelta',
      destinatario: { personaId: solicitud.idPersona },
      datos: { resultado: D.REQUEST_STATE.REJECTED },
    });

    await this.enviarResolucion(solicitud.idPersona, D.ACCESS_STATE.REJECTED, {
      nota: dto.nota,
    });

    return solicitud;
  }

  private async cargarResoluble(id: string): Promise<SolicitudAcceso> {
    const solicitud = await this.solicitudes.findOne({ where: { id } });
    if (!solicitud) {
      throw new AppNotFoundException(K.REQUESTS.NOT_FOUND, { id });
    }
    if (
      solicitud.estado !== D.REQUEST_STATE.PENDING &&
      solicitud.estado !== D.REQUEST_STATE.IN_REVIEW
    ) {
      throw new AppConflictException(K.REQUESTS.ALREADY_RESOLVED);
    }

    return solicitud;
  }
}
