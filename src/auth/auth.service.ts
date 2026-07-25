import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Model } from 'mongoose';
import type { AppConfigService } from '../config';
import { CEDULA_HASHER, type CedulaHasher } from '../crypto';
import {
  User,
  UserDocument,
  type EstadoAcceso,
  type NivelAcceso,
  type TipoPersona,
} from '../users/schemas/user.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';

export type NextStep = 'app' | 'onboarding' | 'suspended';
export type AccountStatus = 'registered' | 'new' | 'inactive';

export interface Person {
  id: string;
  name: string;
  type: TipoPersona;
  accessStatus: EstadoAcceso;
  accessLevel?: NivelAcceso;
}

export interface CheckResult {
  status: AccountStatus;
  person?: Person;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  person: Person;
  nextStep: NextStep;
}

const BCRYPT_ROUNDS = 12;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshModel: Model<RefreshTokenDocument>,
    @Inject(CEDULA_HASHER)
    private readonly cedulaHasher: CedulaHasher,
    private readonly jwt: JwtService,
    @Inject(ConfigService)
    private readonly config: AppConfigService,
  ) {}

  async check(cedula: string): Promise<CheckResult> {
    const user = await this.findByCedula(cedula);
    if (!user) return { status: 'inactive' };
    return {
      status: user.passwordHash ? 'registered' : 'new',
      person: this.toPerson(user),
    };
  }

  async register(cedula: string, password: string): Promise<AuthResult> {
    const user = await this.findByCedula(cedula);
    if (!user) {
      throw new NotFoundException(
        'No existe una persona con esa cédula en SiScout',
      );
    }
    if (user.passwordHash) {
      throw new ConflictException('Ya existe una cuenta para esta cédula');
    }

    user.passwordHash = await hash(password, BCRYPT_ROUNDS);
    await user.save();

    return this.issueAuthResult(user);
  }

  async validateCredentials(
    cedula: string,
    password: string,
  ): Promise<UserDocument> {
    const user = await this.findByCedula(cedula);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }

  async login(user: UserDocument): Promise<AuthResult> {
    return this.issueAuthResult(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const stored = await this.refreshModel
      .findOne({ tokenHash: this.hashToken(refreshToken) })
      .exec();
    if (!stored || stored.revoked || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    stored.revoked = true;
    await stored.save();

    const user = await this.userModel.findById(stored.userId).exec();
    if (!user) {
      throw new UnauthorizedException('La cuenta ya no existe');
    }
    return this.issueAuthResult(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshModel
      .updateOne(
        { tokenHash: this.hashToken(refreshToken) },
        { $set: { revoked: true } },
      )
      .exec();
  }

  async me(userId: string): Promise<Person> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException('La cuenta ya no existe');
    }
    return this.toPerson(user);
  }

  private async issueAuthResult(user: UserDocument): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync({
      sub: String(user._id),
      accessStatus: user.estadoAcceso,
      accessLevel: user.nivelAcceso,
    });
    const refreshToken = await this.createRefreshToken(user);
    return {
      accessToken,
      refreshToken,
      person: this.toPerson(user),
      nextStep: this.resolveNextStep(user.estadoAcceso),
    };
  }

  private async createRefreshToken(user: UserDocument): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const days = this.config.get('JWT_REFRESH_TTL_DAYS', { infer: true });
    await this.refreshModel.create({
      tokenHash: this.hashToken(token),
      userId: user._id,
      expiresAt: new Date(Date.now() + days * MS_PER_DAY),
    });
    return token;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async findByCedula(cedula: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ cedulaHash: this.cedulaHasher.hash(cedula) })
      .exec();
  }

  private toPerson(user: UserDocument): Person {
    return {
      id: String(user._id),
      name: user.name,
      type: user.tipo,
      accessStatus: user.estadoAcceso,
      accessLevel: user.nivelAcceso,
    };
  }

  private resolveNextStep(accessStatus: EstadoAcceso): NextStep {
    if (accessStatus === 'aprobado') return 'app';
    if (accessStatus === 'suspendido') return 'suspended';
    return 'onboarding';
  }
}
