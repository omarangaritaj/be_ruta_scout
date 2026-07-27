import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { hashPassword } from '../auth/password-hashing';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../auth/schemas/refresh-token.schema';
import { AppBadRequestException, AppTooManyRequestsException } from '../common';
import type { AppConfigService } from '../config';
import { CEDULA_HASHER, type CedulaHasher } from '../crypto';
import {
  EMAIL_NOTIFIER,
  type EmailNotifier,
} from '../email/email-notifier.port';
import { K } from '../i18n';
import { RedisService } from '../redis/redis.service';
import { SiscoutSnapshotService } from '../siscout/siscout-snapshot.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { maskEmail } from './mask-email';
import {
  PasswordResetToken,
  PasswordResetTokenDocument,
} from './schemas/password-reset-token.schema';

/**
 * Resultado de pedir un enlace de recuperación. Los cuatro estados son
 * respuestas normales (200), no errores: el frontend los usa para decir algo
 * útil en lugar de un "revisa tu correo" que quizá nunca llegue.
 */
export type PasswordResetRequestStatus =
  'sent' | 'no_account' | 'no_email' | 'not_found';

export interface PasswordResetRequestResult {
  status: PasswordResetRequestStatus;
  emailMasked?: string;
}

export interface PasswordResetTokenCheck {
  valid: boolean;
  name?: string;
}

const MS_PER_MINUTE = 60 * 1000;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(PasswordResetToken.name)
    private readonly tokenModel: Model<PasswordResetTokenDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshModel: Model<RefreshTokenDocument>,
    @Inject(CEDULA_HASHER)
    private readonly cedulaHasher: CedulaHasher,
    @Inject(ConfigService)
    private readonly config: AppConfigService,
    @Inject(EMAIL_NOTIFIER)
    private readonly email: EmailNotifier,
    private readonly snapshots: SiscoutSnapshotService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Paso 1: la persona da su cédula y se le manda el enlace al correo que
   * SiScout tiene registrado. Ese correo es la única prueba de identidad
   * disponible aquí, porque en nuestra base vive cifrado y no lo elegimos
   * nosotros.
   */
  async request(cedula: string): Promise<PasswordResetRequestResult> {
    await this.consumeAttempt(cedula);

    const user = await this.findByCedula(cedula);
    if (!user) return { status: 'not_found' };
    if (!user.passwordHash) return { status: 'no_account' };

    const snapshot = await this.snapshots.findDecrypted(user.idSiscout);
    const to = typeof snapshot?.email === 'string' ? snapshot.email : null;
    if (!to) return { status: 'no_email' };

    const token = await this.issueToken(user);
    const minutes = this.ttlMinutes();

    await this.email.sendPasswordReset({
      to,
      nombre: user.name,
      url: `${this.config.get('SITE_URL', { infer: true })}/restablecer/${token}`,
      minutos: minutes,
    });

    return { status: 'sent', emailMasked: maskEmail(to) };
  }

  /**
   * Paso 2: el enlace se valida ANTES de pintar el formulario. Descubrir que el
   * enlace venció después de escribir la contraseña dos veces es una forma
   * gratuita de perder a un usuario.
   */
  async check(token: string): Promise<PasswordResetTokenCheck> {
    const stored = await this.findUsableToken(token);
    if (!stored) return { valid: false };

    const user = await this.userModel.findById(stored.userId).exec();
    if (!user) return { valid: false };

    return { valid: true, name: user.name };
  }

  /**
   * Paso 3: fija la contraseña nueva y cierra todo lo demás. Si alguien había
   * entrado a la cuenta, este es el momento en que se queda afuera: se revocan
   * sus refresh tokens y se tira el perfil cacheado.
   */
  async confirm(token: string, password: string): Promise<void> {
    const stored = await this.findUsableToken(token);
    if (!stored) {
      throw new AppBadRequestException(K.PASSWORD_RESET.INVALID_TOKEN);
    }

    const user = await this.userModel.findById(stored.userId).exec();
    if (!user) {
      throw new AppBadRequestException(K.PASSWORD_RESET.INVALID_TOKEN);
    }

    user.passwordHash = await hashPassword(password);
    await user.save();

    stored.usedAt = new Date();
    await stored.save();

    await this.discardPendingTokens(stored.userId);
    await this.refreshModel
      .updateMany(
        { userId: stored.userId, revoked: false },
        { $set: { revoked: true } },
      )
      .exec();
    await this.redis.del(`current_user:${user.idSiscout}`);
  }

  /**
   * Cuenta los intentos por cédula (por su HMAC: en Redis no se guarda PII en
   * claro). Sin esto, cualquiera que conozca una cédula ajena le llena el buzón
   * a esa persona. Si Redis no responde, el contador degrada a permitir: un
   * fallo del cache no puede dejar sin recuperar la contraseña a nadie.
   */
  private async consumeAttempt(cedula: string): Promise<void> {
    const key = `password_reset_attempts:${this.cedulaHasher.hash(cedula)}`;
    const attempts = (await this.redis.get<number>(key)) ?? 0;

    if (attempts >= RATE_LIMIT_MAX) {
      throw new AppTooManyRequestsException(K.PASSWORD_RESET.TOO_MANY_REQUESTS);
    }

    await this.redis.set(key, attempts + 1, RATE_LIMIT_WINDOW_SECONDS);
  }

  /**
   * Emite el token y descarta los anteriores: pedir un enlace nuevo invalida el
   * viejo, así el correo más reciente es siempre el que sirve.
   */
  private async issueToken(user: UserDocument): Promise<string> {
    await this.discardPendingTokens(user._id);

    const token = randomBytes(32).toString('base64url');
    await this.tokenModel.create({
      tokenHash: this.hashToken(token),
      userId: user._id,
      expiresAt: new Date(Date.now() + this.ttlMinutes() * MS_PER_MINUTE),
      usedAt: null,
    });

    return token;
  }

  private async findUsableToken(
    token: string,
  ): Promise<PasswordResetTokenDocument | null> {
    const stored = await this.tokenModel
      .findOne({ tokenHash: this.hashToken(token) })
      .exec();

    if (!stored) return null;
    if (stored.usedAt) return null;
    if (stored.expiresAt.getTime() < Date.now()) return null;

    return stored;
  }

  private async discardPendingTokens(userId: Types.ObjectId): Promise<void> {
    await this.tokenModel.deleteMany({ userId, usedAt: null }).exec();
  }

  private ttlMinutes(): number {
    return this.config.get('PASSWORD_RESET_TTL_MINUTES', { infer: true });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async findByCedula(cedula: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ cedulaHash: this.cedulaHasher.hash(cedula) })
      .exec();
  }
}
