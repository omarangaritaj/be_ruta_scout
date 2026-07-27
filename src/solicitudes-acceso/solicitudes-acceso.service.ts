import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  cargoEsValido,
  type NivelSolicitud,
} from '../catalogo-cargos/catalogo-cargos';
import {
  AppBadRequestException,
  AppConflictException,
  AppNotFoundException,
} from '../common';
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
  ) {}

  private readonly logger = new Logger(SolicitudesAccesoService.name);

  private nombreTerritorio(
    nivel: NivelSolicitud,
    snapshot: Record<string, unknown> | null,
  ): string | null {
    if (nivel === 'grupo' && typeof snapshot?.group_name === 'string') {
      return snapshot.group_name;
    }
    if (nivel === 'region' && typeof snapshot?.district_name === 'string') {
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
    resultado: 'aprobado' | 'rechazado',
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
    if (persona.estadoAcceso === 'aprobado') {
      throw new AppConflictException(K.REQUESTS.ACCESS_ALREADY_APPROVED);
    }
    if (persona.estadoAcceso === 'suspendido') {
      throw new AppConflictException(K.REQUESTS.ACCESS_SUSPENDED);
    }
    if (!cargoEsValido(dto.cargo, dto.nivel)) {
      throw new AppBadRequestException(K.REQUESTS.POSITION_LEVEL_MISMATCH);
    }

    const activa = await this.solicitudModel
      .findOne({
        idPersona: persona._id,
        estado: { $in: ['pendiente', 'en_revision'] },
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
      estado: 'pendiente',
    });

    await this.userModel
      .updateOne({ _id: persona._id }, { $set: { estadoAcceso: 'pendiente' } })
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
      .find({ estado: { $in: ['pendiente', 'en_revision'] } })
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
    // desde la lista blanca, así que descifrar el snapshot para esto sería
    // pagar una lectura de la colección privada por datos que no son PII.
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

  async aprobar(
    id: string,
    dto: AprobarSolicitudDto,
  ): Promise<SolicitudAccesoDocument> {
    const solicitud = await this.cargarResoluble(id);
    const nivel = dto.nivel ?? solicitud.nivelSolicitado;
    const cargo = dto.cargo ?? solicitud.cargoSolicitado;

    if (!cargoEsValido(cargo, nivel)) {
      throw new AppBadRequestException(K.REQUESTS.POSITION_LEVEL_MISMATCH);
    }

    await this.userModel
      .updateOne(
        { _id: solicitud.idPersona },
        { $set: { estadoAcceso: 'aprobado', nivelAcceso: nivel } },
      )
      .exec();

    solicitud.estado = 'aprobada';
    solicitud.nivelAprobado = nivel;
    solicitud.cargoAprobado = cargo;
    solicitud.notaAprobador = dto.nota;
    solicitud.resueltoEn = new Date();
    await solicitud.save();

    await this.notificador.encolar({
      tipo: 'solicitud_resuelta',
      destinatario: { personaId: String(solicitud.idPersona) },
      datos: { resultado: 'aprobada', nivel, cargo },
    });

    await this.enviarResolucion(solicitud.idPersona, 'aprobado', {
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
        { $set: { estadoAcceso: 'rechazado' } },
      )
      .exec();

    solicitud.estado = 'rechazada';
    solicitud.notaAprobador = dto.nota;
    solicitud.resueltoEn = new Date();
    await solicitud.save();

    await this.notificador.encolar({
      tipo: 'solicitud_resuelta',
      destinatario: { personaId: String(solicitud.idPersona) },
      datos: { resultado: 'rechazada' },
    });

    await this.enviarResolucion(solicitud.idPersona, 'rechazado', {
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
      solicitud.estado !== 'pendiente' &&
      solicitud.estado !== 'en_revision'
    ) {
      throw new AppConflictException(K.REQUESTS.ALREADY_RESOLVED);
    }

    return solicitud;
  }
}
