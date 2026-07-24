import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { AppConfigService } from '../../config';

/** Valor cifrado tal y como se guarda en el snapshot. */
export interface EncryptedField {
  __enc: 1;
  iv: string;
  tag: string;
  data: string;
}

/** Distingue un valor cifrado de uno en claro o nulo. */
export function isEncrypted(value: unknown): value is EncryptedField {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __enc?: unknown }).__enc === 1
  );
}

/**
 * Cifra y descifra valores individuales con AES-256-GCM.
 *
 * GCM es un cifrado AUTENTICADO: el `tag` detecta cualquier manipulación del
 * dato en reposo. Cada operación usa un IV aleatorio, por lo que el mismo texto
 * produce un cifrado distinto cada vez — de ahí que el hash del snapshot deba
 * calcularse SIEMPRE sobre el texto plano, nunca sobre el cifrado.
 */
@Injectable()
export class FieldCipher {
  private readonly key: Buffer | null;

  constructor(
    @Inject(ConfigService)
    config: AppConfigService,
  ) {
    const raw = config.get('SISCOUT_ENCRYPTION_KEY', { infer: true });
    this.key = raw ? this.decodeKey(raw) : null;
  }

  /** Indica si hay clave configurada y, por tanto, se puede cifrar. */
  isReady(): boolean {
    return this.key !== null;
  }

  encrypt(plainText: string): EncryptedField {
    if (!this.key) {
      throw new Error('SISCOUT_ENCRYPTION_KEY no está configurada');
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);

    return {
      __enc: 1,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: data.toString('base64'),
    };
  }

  decrypt(value: EncryptedField): string {
    if (!this.key) {
      throw new Error('SISCOUT_ENCRYPTION_KEY no está configurada');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(value.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(value.data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private decodeKey(raw: string): Buffer {
    const buffer =
      /^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0
        ? Buffer.from(raw, 'hex')
        : Buffer.from(raw, 'base64');

    if (buffer.length !== 32) {
      throw new Error(
        `SISCOUT_ENCRYPTION_KEY debe decodificar a 32 bytes, no ${buffer.length}`,
      );
    }

    return buffer;
  }
}
