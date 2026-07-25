import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { cargoEsValido } from '../catalogo-cargos/catalogo-cargos';
import { CEDULA_HASHER, type CedulaHasher } from '../crypto';
import { Notificador } from '../notificaciones/notificador.port';
import { SiscoutSnapshotService } from '../siscout/siscout-snapshot.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import type { CrearSolicitudDto } from './dto/crear-solicitud.dto';
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
    @Inject(CEDULA_HASHER)
    private readonly cedulaHasher: CedulaHasher,
    private readonly notificador: Notificador,
    private readonly snapshots: SiscoutSnapshotService,
  ) {}

  async crear(dto: CrearSolicitudDto): Promise<SolicitudAccesoDocument> {
    const persona = await this.userModel
      .findOne({ cedulaHash: this.cedulaHasher.hash(dto.cedula) })
      .exec();

    if (!persona) {
      throw new NotFoundException(
        'No existe una persona con esa cédula en SiScout',
      );
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
}
