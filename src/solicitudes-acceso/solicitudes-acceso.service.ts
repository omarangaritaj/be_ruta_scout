import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { cargoEsValido } from '../catalogo-cargos/catalogo-cargos';
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
  ) {}

  async crear(
    userId: string,
    dto: CrearSolicitudDto,
  ): Promise<SolicitudAccesoDocument> {
    const persona = await this.userModel.findById(userId).exec();

    if (!persona) {
      throw new NotFoundException('No existe la persona autenticada');
    }
    if (persona.estadoAcceso === 'aprobado') {
      throw new ConflictException('El acceso ya está aprobado');
    }
    if (persona.estadoAcceso === 'suspendido') {
      throw new ConflictException('El acceso está suspendido');
    }
    if (!cargoEsValido(dto.cargo, dto.nivel)) {
      throw new BadRequestException('El cargo no corresponde al nivel');
    }

    const activa = await this.solicitudModel
      .findOne({
        idPersona: persona._id,
        estado: { $in: ['pendiente', 'en_revision'] },
      })
      .exec();
    if (activa) {
      throw new ConflictException('Ya hay una solicitud en curso');
    }

    const snapshot = await this.snapshots.findDecrypted(persona.idSiscout);
    const territorio = resolverTerritorio(dto.nivel, snapshot, {
      rama: dto.rama,
      groupId: dto.groupId,
      districtId: dto.districtId,
    });
    if ('error' in territorio) {
      throw new BadRequestException(territorio.error);
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
      throw new NotFoundException(`No existe la solicitud "${id}"`);
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
      throw new NotFoundException('No existe la persona autenticada');
    }

    const snapshot = await this.snapshots.findDecrypted(persona.idSiscout);
    const texto = (valor: unknown): string | null =>
      typeof valor === 'string' ? valor : null;
    const entero = (valor: unknown): number | null =>
      typeof valor === 'number' ? valor : null;

    return {
      estadoAcceso: persona.estadoAcceso,
      nivelAcceso: persona.nivelAcceso,
      groupId: entero(snapshot?.group_id),
      groupName: texto(snapshot?.group_name),
      districtId: entero(snapshot?.district_id),
      districtName: texto(snapshot?.district_name),
      cargoSiscout: texto(snapshot?.cargo),
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
      throw new BadRequestException('El cargo no corresponde al nivel');
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

    return solicitud;
  }

  private async cargarResoluble(id: string): Promise<SolicitudAccesoDocument> {
    const solicitud = await this.solicitudModel.findById(id).exec();

    if (!solicitud) {
      throw new NotFoundException(`No existe la solicitud "${id}"`);
    }
    if (
      solicitud.estado !== 'pendiente' &&
      solicitud.estado !== 'en_revision'
    ) {
      throw new ConflictException('La solicitud ya fue resuelta');
    }

    return solicitud;
  }
}
