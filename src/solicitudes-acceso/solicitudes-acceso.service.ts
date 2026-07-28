import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
import { SiscoutSnapshotService } from '../siscout/siscout-snapshot.service';
import {
  User,
  UserDocument,
  type EstadoAcceso,
  type NivelAcceso,
} from '../users/schemas/user.schema';
import type { CrearSolicitudDto } from './dto/crear-solicitud.dto';
import type {
  AprobarSolicitudDto,
  RechazarSolicitudDto,
} from './dto/resolver-solicitud.dto';
import {
  SolicitudAcceso,
  SolicitudAccesoDocument,
} from './schemas/solicitud-acceso.schema';
import { resolverTerritorio } from './territorio';

@Injectable()
export class SolicitudesAccesoService {
  constructor(
    @InjectModel(SolicitudAcceso.name)
    private readonly solicitudModel: Model<SolicitudAccesoDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
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
    idPersona: Types.ObjectId,
  ): Promise<{ to: string; nombre: string } | null> {
    const persona = await this.userModel.findById(idPersona).exec();
    if (!persona) return null;
    const snapshot = await this.snapshots.findDecrypted(persona.idSiscout);
    const to = typeof snapshot?.email === 'string' ? snapshot.email : null;
    return to ? { to, nombre: persona.name } : null;
  }

  private async enviarResolucion(
    idPersona: Types.ObjectId,
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
  ): Promise<SolicitudAccesoDocument> {
    const persona = await this.userModel.findById(userId).exec();

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

    const activa = await this.solicitudModel
      .findOne({
        idPersona: persona._id,
        estado: { $in: [D.REQUEST_STATE.PENDING, D.REQUEST_STATE.IN_REVIEW] },
      })
      .exec();
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

    const solicitud = await this.solicitudModel.create({
      idPersona: persona._id,
      nivelSolicitado: dto.nivel,
      cargoSolicitado: dto.cargo,
      telefonoContacto: dto.telefono,
      rama: territorio.rama,
      groupId: territorio.groupId,
      districtId: territorio.districtId,
      estado: D.REQUEST_STATE.PENDING,
    });

    await this.userModel
      .updateOne(
        { _id: persona._id },
        { $set: { estadoAcceso: D.ACCESS_STATE.PENDING } },
      )
      .exec();

    await this.notificador.encolar({
      tipo: 'solicitud_recibida',
      destinatario: { personaId: String(persona._id) },
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

  async listarPendientes(): Promise<SolicitudAccesoDocument[]> {
    return this.solicitudModel
      .find({
        estado: { $in: [D.REQUEST_STATE.PENDING, D.REQUEST_STATE.IN_REVIEW] },
      })
      .populate('idPersona', 'name idSiscout tipo')
      .sort({ createdAt: 1 })
      .exec();
  }

  async findOne(id: string): Promise<SolicitudAccesoDocument> {
    const solicitud = await this.solicitudModel
      .findById(id)
      .populate('idPersona', 'name idSiscout tipo')
      .exec();
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
    const persona = await this.userModel.findById(userId).exec();
    if (!persona) {
      throw new AppNotFoundException(K.REQUESTS.AUTHENTICATED_PERSON_NOT_FOUND);
    }

    // Territorio y cargo se leen del documento público: el sync los proyecta
    // desde la lista de permitidos, así que descifrar el snapshot para esto
    // sería pagar una lectura de la colección privada por datos que no son PII.
    return {
      estadoAcceso: persona.estadoAcceso,
      nivelAcceso: persona.nivelAcceso,
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
  ): Promise<SolicitudAccesoDocument> {
    const solicitud = await this.cargarResoluble(id);
    // El nivel efectivo, no solo `dto.nivel`: sin él se aprueba tal cual lo
    // pidió el solicitante, que es exactamente el mismo privilegio.
    const nivel = dto.nivel ?? solicitud.nivelSolicitado;
    const cargo = dto.cargo ?? solicitud.cargoSolicitado;

    await this.escalation.assertCanGrantLevel(actorId, nivel);

    if (!cargoEsValido(cargo, nivel)) {
      throw new AppBadRequestException(K.REQUESTS.POSITION_LEVEL_MISMATCH);
    }

    await this.userModel
      .updateOne(
        { _id: solicitud.idPersona },
        { $set: { estadoAcceso: D.ACCESS_STATE.APPROVED, nivelAcceso: nivel } },
      )
      .exec();

    solicitud.estado = D.REQUEST_STATE.APPROVED;
    solicitud.nivelAprobado = nivel;
    solicitud.cargoAprobado = cargo;
    solicitud.notaAprobador = dto.nota;
    solicitud.resueltoEn = new Date();
    await solicitud.save();

    await this.notificador.encolar({
      tipo: 'solicitud_resuelta',
      destinatario: { personaId: String(solicitud.idPersona) },
      datos: { resultado: D.REQUEST_STATE.APPROVED, nivel, cargo },
    });

    await this.enviarResolucion(solicitud.idPersona, D.ACCESS_STATE.APPROVED, {
      nivel,
      cargo,
    });

    return solicitud;
  }

  async rechazar(
    id: string,
    dto: RechazarSolicitudDto,
  ): Promise<SolicitudAccesoDocument> {
    const solicitud = await this.cargarResoluble(id);

    await this.userModel
      .updateOne(
        { _id: solicitud.idPersona },
        { $set: { estadoAcceso: D.ACCESS_STATE.REJECTED } },
      )
      .exec();

    solicitud.estado = D.REQUEST_STATE.REJECTED;
    solicitud.notaAprobador = dto.nota;
    solicitud.resueltoEn = new Date();
    await solicitud.save();

    await this.notificador.encolar({
      tipo: 'solicitud_resuelta',
      destinatario: { personaId: String(solicitud.idPersona) },
      datos: { resultado: D.REQUEST_STATE.REJECTED },
    });

    await this.enviarResolucion(solicitud.idPersona, D.ACCESS_STATE.REJECTED, {
      nota: dto.nota,
    });

    return solicitud;
  }

  private async cargarResoluble(id: string): Promise<SolicitudAccesoDocument> {
    const solicitud = await this.solicitudModel.findById(id).exec();

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
