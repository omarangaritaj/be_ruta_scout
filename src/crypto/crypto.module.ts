import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../config';
import { CedulaHasher } from './cedula-hasher';
import { FieldCipher } from './field-cipher';
import { parseKeyring } from './keyring';

/**
 * Cifra la PII del snapshot de SiScout: cédula, teléfono y correo.
 */
export const SNAPSHOT_CIPHER = 'SNAPSHOT_CIPHER';
export const CREDENTIALS_CIPHER = 'CREDENTIALS_CIPHER';
export const CEDULA_HASHER = 'CEDULA_HASHER';

/** Variables de entorno que contienen conjuntos de claves. */
type KeyVariable =
  'SISCOUT_ENCRYPTION_KEY' | 'SISCOUT_CREDENTIALS_KEY' | 'CEDULA_HASH_KEY';

function provideCipher(token: string, variableName: KeyVariable): Provider {
  return {
    provide: token,
    inject: [ConfigService],
    useFactory: (config: AppConfigService): FieldCipher => {
      const raw: string | undefined = config.get(variableName, { infer: true });

      // Sin clave el cifrador se construye igual pero queda inutilizable. La
      // aplicación arranca y quien la necesite falla con un mensaje claro, en
      // lugar de tumbar el arranque entero por una integración opcional.
      return new FieldCipher(
        raw ? parseKeyring(raw, variableName) : null,
        variableName,
      );
    },
  };
}

/**
 * Módulo GLOBAL de cifrado.
 *
 * Los cifradores se inyectan por TOKEN, no por tipo: hay dos instancias de la
 * misma clase y solo el token distingue con qué clave trabaja cada una.
 */
const cedulaHasherProvider: Provider = {
  provide: CEDULA_HASHER,
  inject: [ConfigService],
  useFactory: (config: AppConfigService): CedulaHasher => {
    const raw: string | undefined = config.get('CEDULA_HASH_KEY', {
      infer: true,
    });
    return new CedulaHasher(raw ? parseKeyring(raw, 'CEDULA_HASH_KEY') : null);
  },
};

@Global()
@Module({
  providers: [
    provideCipher(SNAPSHOT_CIPHER, 'SISCOUT_ENCRYPTION_KEY'),
    provideCipher(CREDENTIALS_CIPHER, 'SISCOUT_CREDENTIALS_KEY'),
    cedulaHasherProvider,
  ],
  exports: [SNAPSHOT_CIPHER, CREDENTIALS_CIPHER, CEDULA_HASHER],
})
export class CryptoModule {}
