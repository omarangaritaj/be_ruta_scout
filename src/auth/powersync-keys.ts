import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPrivateKey,
  createPublicKey,
  createSign,
  type KeyObject,
} from 'node:crypto';
import type { AppConfigService } from '../config';

/** kid estable: lo lleva el header del token y la clave del JWKS. */
const KID = 'powersync-rs256';

export interface PowerSyncJwks {
  keys: Record<string, unknown>[];
}

/**
 * Firma los tokens de PowerSync con RS256 y publica la clave pública como JWKS.
 * Se firma con `crypto` de Node directamente (no `@nestjs/jwt`, que en v11 no
 * respeta un `privateKey` por-llamada cuando el módulo se configuró con un
 * secreto HS256). Si `POWERSYNC_JWT_PRIVATE_KEY` no está, queda deshabilitado y
 * el emisor cae a HS256.
 */
@Injectable()
export class PowerSyncKeyService {
  private readonly privateKey: KeyObject | null;
  private readonly _publicJwk: Record<string, unknown> | null;

  constructor(@Inject(ConfigService) config: AppConfigService) {
    const b64 = config.get('POWERSYNC_JWT_PRIVATE_KEY', { infer: true });
    if (!b64) {
      this.privateKey = null;
      this._publicJwk = null;
      return;
    }

    const priv = createPrivateKey(Buffer.from(b64, 'base64').toString('utf8'));
    this.privateKey = priv;

    const jwk = createPublicKey(priv).export({
      format: 'jwk',
    }) as unknown as Record<string, unknown>;
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    jwk.kid = KID;
    this._publicJwk = jwk;
  }

  get enabled(): boolean {
    return this.privateKey !== null;
  }

  /** Firma un JWT RS256 `{ sub, aud, iat, exp }` con el header `kid`. */
  signToken(subject: string, audience: string, ttlSeconds: number): string {
    if (!this.privateKey) {
      throw new Error('PowerSync RS256 no está configurado');
    }
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT', kid: KID };
    const payload = {
      sub: subject,
      aud: audience,
      iat: now,
      exp: now + ttlSeconds,
    };
    const encode = (part: unknown): string =>
      Buffer.from(JSON.stringify(part)).toString('base64url');

    const signingInput = `${encode(header)}.${encode(payload)}`;
    const signature = createSign('RSA-SHA256')
      .update(signingInput)
      .sign(this.privateKey, 'base64url');

    return `${signingInput}.${signature}`;
  }

  /** JWKS público para que PowerSync valide los tokens (vacío si no hay clave). */
  jwks(): PowerSyncJwks {
    return { keys: this._publicJwk ? [this._publicJwk] : [] };
  }
}
