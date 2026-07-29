import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Model } from 'mongoose';
import { PermissionsService } from '../authz/permissions.service';
import {
  AppConflictException,
  AppForbiddenException,
  AppNotFoundException,
  AppUnauthorizedException,
} from '../common';
import { K } from '../i18n';
import type { AppConfigService } from '../config';
import { CEDULA_HASHER, type CedulaHasher } from '../crypto';
import {
  User,
  UserDocument,
  type EstadoAcceso,
  type NivelAcceso,
  type TipoPersona,
} from '../users/schemas/user.schema';
import { CurrentUserService } from '../current-user/current-user.service';
import { D } from '../domain';
import { PowerSyncKeyService, type PowerSyncJwks } from './powersync-keys';
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

/** Persona autenticada con sus permisos y rutas efectivos (respuesta de /auth/me). */
export interface AuthenticatedUser extends Person {
  permissions: string[];
  resources: string[];
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  person: Person;
  nextStep: NextStep;
}

/** Credenciales que el cliente offline usa para conectarse a PowerSync. */
export interface PowerSyncTokenResult {
  token: string;
  powersyncUrl: string | null;
}

const BCRYPT_ROUNDS = 12;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Audiencia que debe llevar el token PowerSync; DEBE coincidir con
// `client_auth.audience` en infra_ruta/powersync/service.yaml (PS_JWT_AUDIENCE).
const POWERSYNC_AUDIENCE = 'powersync';
// Vida corta (segundos): el cliente lo renueva vía fetchCredentials al reconectar.
const POWERSYNC_TOKEN_TTL_SECONDS = 300;

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
    private readonly permissions: PermissionsService,
    private readonly powerSyncKeys: PowerSyncKeyService,
    private readonly currentUser: CurrentUserService,
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
      throw new AppNotFoundException(K.AUTH.PERSON_NOT_IN_SISCOUT);
    }
    if (user.passwordHash) {
      throw new AppConflictException(K.AUTH.ACCOUNT_ALREADY_EXISTS);
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
      throw new AppUnauthorizedException(K.AUTH.INVALID_CREDENTIALS);
    }
    if (!(await compare(password, user.passwordHash))) {
      throw new AppUnauthorizedException(K.AUTH.INVALID_CREDENTIALS);
    }

    await this.currentUser.seed(user.idSiscout);
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
      throw new AppUnauthorizedException(K.AUTH.REFRESH_TOKEN_INVALID);
    }

    stored.revoked = true;
    await stored.save();

    const user = await this.userModel.findById(stored.userId).exec();
    if (!user) {
      throw new AppUnauthorizedException(K.AUTH.ACCOUNT_GONE);
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

  async me(userId: string): Promise<AuthenticatedUser> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new AppUnauthorizedException(K.AUTH.ACCOUNT_GONE);
    }
    const [permissions, resources] = await Promise.all([
      this.permissions.effectivePermissions(userId),
      this.permissions.effectiveResources(userId),
    ]);
    return {
      ...this.toPerson(user),
      permissions: [...permissions],
      resources: [...resources],
    };
  }

  /**
   * Emite un token de corta vida para que el cliente se autentique contra
   * PowerSync (sync offline de campo). Solo para usuarios con acceso aprobado:
   * los datos de campo son de menores y solo un dirigente con acceso los sincroniza.
   */
  async powersyncToken(userId: string): Promise<PowerSyncTokenResult> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new AppUnauthorizedException(K.AUTH.ACCOUNT_GONE);
    }
    if (user.estadoAcceso !== D.ACCESS_STATE.APPROVED) {
      throw new AppForbiddenException(K.AUTH.SYNC_REQUIRES_APPROVED_ACCESS);
    }

    const subject = String(user._id);
    const token = this.powerSyncKeys.enabled
      ? this.powerSyncKeys.signToken(
          subject,
          POWERSYNC_AUDIENCE,
          POWERSYNC_TOKEN_TTL_SECONDS,
        )
      : await this.jwt.signAsync(
          { sub: subject },
          {
            audience: POWERSYNC_AUDIENCE,
            expiresIn: POWERSYNC_TOKEN_TTL_SECONDS,
          },
        );
    const powersyncUrl =
      this.config.get('POWERSYNC_URL', { infer: true }) ?? null;

    return { token, powersyncUrl };
  }

  /** JWKS público con la clave que valida los tokens de PowerSync (RS256). */
  powerSyncJwks(): PowerSyncJwks {
    return this.powerSyncKeys.jwks();
  }

  private async issueAuthResult(user: UserDocument): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync({
      sub: String(user._id),
      idSiscout: user.idSiscout,
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
    if (accessStatus === D.ACCESS_STATE.APPROVED) return 'app';
    if (accessStatus === D.ACCESS_STATE.SUSPENDED) return 'suspended';
    return 'onboarding';
  }
}
