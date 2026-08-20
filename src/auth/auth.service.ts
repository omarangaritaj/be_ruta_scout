import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { PermissionsService } from '../authz/permissions.service';
import {
  AppConflictException,
  AppNotFoundException,
  AppUnauthorizedException,
} from '../common';
import { K } from '../i18n';
import type { AppConfigService } from '../config';
import { CEDULA_HASHER, type CedulaHasher } from '../crypto';
import {
  User,
  type EstadoAcceso,
  type NivelAcceso,
  type TipoPersona,
} from '../users/user.entity';
import { D } from '../domain';
import { BCRYPT_ROUNDS } from './password-hashing';
import { RefreshToken } from './refresh-token.entity';

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
  /** Roles activos: las raíces de su subárbol para la jerarquía de roles. */
  roleIds: string[];
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  person: Person;
  nextStep: NextStep;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    @Inject(CEDULA_HASHER)
    private readonly cedulaHasher: CedulaHasher,
    private readonly jwt: JwtService,
    @Inject(ConfigService)
    private readonly config: AppConfigService,
    private readonly permissions: PermissionsService,
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
    await this.users.save(user);

    return this.issueAuthResult(user);
  }

  async validateCredentials(cedula: string, password: string): Promise<User> {
    const user = await this.findByCedula(cedula);
    if (!user?.passwordHash) {
      throw new AppUnauthorizedException(K.AUTH.INVALID_CREDENTIALS);
    }
    if (!(await compare(password, user.passwordHash))) {
      throw new AppUnauthorizedException(K.AUTH.INVALID_CREDENTIALS);
    }

    return user;
  }

  async login(user: User): Promise<AuthResult> {
    return this.issueAuthResult(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: this.hashToken(refreshToken) },
    });
    if (!stored || stored.revoked || stored.expiresAt.getTime() < Date.now()) {
      throw new AppUnauthorizedException(K.AUTH.REFRESH_TOKEN_INVALID);
    }

    stored.revoked = true;
    await this.refreshTokens.save(stored);

    const user = await this.users.findOne({ where: { id: stored.userId } });
    if (!user) {
      throw new AppUnauthorizedException(K.AUTH.ACCOUNT_GONE);
    }
    return this.issueAuthResult(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokens.update(
      { tokenHash: this.hashToken(refreshToken) },
      { revoked: true },
    );
  }

  async me(userId: string): Promise<AuthenticatedUser> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppUnauthorizedException(K.AUTH.ACCOUNT_GONE);
    }
    const [permissions, resources, roleIds] = await Promise.all([
      this.permissions.effectivePermissions(userId),
      this.permissions.effectiveResources(userId),
      // Las raíces de su subárbol de roles: sin esto el frontend no puede
      // saber qué roles le pertenecen y tendría que ofrecerlos todos para que
      // be_ruta rechace con un 403 lo que nunca debió mostrarse.
      this.permissions.effectiveRoleIds(userId),
    ]);
    return {
      ...this.toPerson(user),
      permissions: [...permissions],
      resources: [...resources],
      roleIds,
    };
  }

  private async issueAuthResult(user: User): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      idSiscout: user.idSiscout,
      accessStatus: user.estadoAcceso,
      accessLevel: user.nivelAcceso ?? undefined,
    });
    const refreshToken = await this.createRefreshToken(user);
    return {
      accessToken,
      refreshToken,
      person: this.toPerson(user),
      nextStep: this.resolveNextStep(user.estadoAcceso),
    };
  }

  private async createRefreshToken(user: User): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const days = this.config.get('JWT_REFRESH_TTL_DAYS', { infer: true });
    await this.refreshTokens.save(
      this.refreshTokens.create({
        tokenHash: this.hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + days * MS_PER_DAY),
      }),
    );
    return token;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Busca por el HMAC de la cédula. `cedulaHash` y `passwordHash` llevan
   * `select: false` en la entidad, así que aquí se piden explícitamente:
   * auth es el único lugar que los necesita.
   */
  private async findByCedula(cedula: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect(['user.cedulaHash', 'user.passwordHash'])
      .where('user.cedulaHash = :hash', {
        hash: this.cedulaHasher.hash(cedula),
      })
      .getOne();
  }

  private toPerson(user: User): Person {
    return {
      id: user.id,
      name: user.name,
      type: user.tipo,
      accessStatus: user.estadoAcceso,
      accessLevel: user.nivelAcceso ?? undefined,
    };
  }

  private resolveNextStep(accessStatus: EstadoAcceso): NextStep {
    if (accessStatus === D.ACCESS_STATE.APPROVED) return 'app';
    if (accessStatus === D.ACCESS_STATE.SUSPENDED) return 'suspended';
    return 'onboarding';
  }
}
