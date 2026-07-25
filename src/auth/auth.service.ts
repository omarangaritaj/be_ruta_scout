import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CEDULA_HASHER, type CedulaHasher } from '../crypto';
import {
  User,
  UserDocument,
  type EstadoAcceso,
  type NivelAcceso,
  type TipoPersona,
} from '../users/schemas/user.schema';

export type SiguientePaso = 'app' | 'onboarding' | 'suspendido';

export interface LoginResult {
  persona: {
    id: string;
    name: string;
    tipo: TipoPersona;
    estadoAcceso: EstadoAcceso;
    nivelAcceso?: NivelAcceso;
  };
  siguientePaso: SiguientePaso;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @Inject(CEDULA_HASHER)
    private readonly cedulaHasher: CedulaHasher,
  ) {}

  async login(cedula: string): Promise<LoginResult> {
    const user = await this.userModel
      .findOne({ cedulaHash: this.cedulaHasher.hash(cedula) })
      .exec();

    if (!user) {
      throw new NotFoundException(
        'No existe una persona con esa cédula en SiScout',
      );
    }

    return {
      persona: {
        id: String(user._id),
        name: user.name,
        tipo: user.tipo,
        estadoAcceso: user.estadoAcceso,
        nivelAcceso: user.nivelAcceso,
      },
      siguientePaso: this.siguientePaso(user.estadoAcceso),
    };
  }

  private siguientePaso(estadoAcceso: EstadoAcceso): SiguientePaso {
    if (estadoAcceso === 'aprobado') return 'app';
    if (estadoAcceso === 'suspendido') return 'suspendido';
    return 'onboarding';
  }
}
