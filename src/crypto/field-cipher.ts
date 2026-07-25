import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { LEGACY_KID, type Keyring } from './keyring';

/** Valor cifrado tal y como se guarda en la base. */
export interface EncryptedField {
  /** Versión del FORMATO del sobre, no de la clave. */
  __enc: 1;
  /**
   * Identificador de la clave con la que se cifró.
   *
   * Es lo que hace posible rotar: sin él no habría forma de saber cuál de las
   * claves configuradas abre este dato, y cambiar la clave dejaría ilegible
   * todo lo escrito antes. Ausente en los documentos más antiguos, que se
   * resuelven a `v1`.
   */
  kid?: string;
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
 * produce un cifrado distinto cada vez — de ahí que el hash de un documento
 * deba calcularse SIEMPRE sobre el texto plano, nunca sobre el cifrado.
 *
 * No lee el entorno: recibe el conjunto de claves ya interpretado. Así la misma
 * clase sirve a dominios distintos (la PII del snapshot y las contraseñas del
 * pool de credenciales) con claves SEPARADAS, y filtrar una no compromete la
 * otra.
 */
export class FieldCipher {
  /**
   * @param keyring Claves vigentes, o `null` si no hay ninguna configurada.
   * @param variableName Variable de entorno de la que salen, solo para que los
   *   mensajes de error digan cuál hay que revisar.
   */
  constructor(
    private readonly keyring: Keyring | null,
    private readonly variableName: string,
  ) {}

  /** Indica si hay clave configurada y, por tanto, se puede cifrar. */
  isReady(): boolean {
    return this.keyring !== null;
  }

  encrypt(plainText: string): EncryptedField {
    const keyring = this.requireKeyring();
    const key = keyring.keys.get(keyring.activeKid) as Buffer;

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);

    return {
      __enc: 1,
      kid: keyring.activeKid,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: data.toString('base64'),
    };
  }

  decrypt(value: EncryptedField): string {
    const keyring = this.requireKeyring();
    const kid = value.kid ?? LEGACY_KID;
    const key = keyring.keys.get(kid);

    // Sin esta comprobación el fallo llegaría como un error de auth tag de
    // OpenSSL, indistinguible de un dato corrupto. Y no es lo mismo: aquí el
    // dato está intacto y lo que falta es la clave con la que se escribió.
    if (!key) {
      throw new Error(
        `${this.variableName} no incluye la clave '${kid}', con la que se cifró ` +
          `este dato. Añádela al conjunto de claves para poder leerlo.`,
      );
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(value.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(value.data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private requireKeyring(): Keyring {
    if (!this.keyring) {
      throw new Error(`${this.variableName} no está configurada`);
    }
    return this.keyring;
  }
}
