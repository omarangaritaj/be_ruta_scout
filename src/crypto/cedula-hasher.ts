import { createHmac } from 'node:crypto';
import type { Keyring } from './keyring';

/**
 * HMAC-SHA256 determinista de la cédula, para buscarla sin descifrarla: el mismo
 * valor produce siempre el mismo hash (a diferencia del cifrado AES-GCM, que usa
 * IV aleatorio y no es consultable). La cédula real nunca se guarda en claro.
 */
export class CedulaHasher {
  constructor(private readonly keyring: Keyring | null) {}

  isReady(): boolean {
    return this.keyring !== null;
  }

  hash(cedula: string): string {
    const key = this.keyring?.keys.get(this.keyring.activeKid);
    if (!key) {
      throw new Error('CEDULA_HASH_KEY no está configurada');
    }
    return createHmac('sha256', key).update(cedula.trim()).digest('hex');
  }
}
