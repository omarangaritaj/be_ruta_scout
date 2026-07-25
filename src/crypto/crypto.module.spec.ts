import { randomBytes } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  CREDENTIALS_CIPHER,
  CryptoModule,
  SNAPSHOT_CIPHER,
} from './crypto.module';
import type { FieldCipher } from './field-cipher';

function clave(): string {
  return randomBytes(32).toString('base64');
}

async function montar(entorno: Record<string, string | undefined>) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => entorno],
      }),
      CryptoModule,
    ],
  }).compile();

  return {
    snapshot: moduleRef.get<FieldCipher>(SNAPSHOT_CIPHER),
    credentials: moduleRef.get<FieldCipher>(CREDENTIALS_CIPHER),
  };
}

describe('CryptoModule', () => {
  it('provee un cifrador por dominio', async () => {
    const { snapshot, credentials } = await montar({
      SISCOUT_ENCRYPTION_KEY: clave(),
      SISCOUT_CREDENTIALS_KEY: clave(),
    });

    expect(snapshot.isReady()).toBe(true);
    expect(credentials.isReady()).toBe(true);
    expect(snapshot).not.toBe(credentials);
  });

  describe('separación de dominios criptográficos', () => {
    it('la clave del snapshot NO abre lo cifrado con la de credenciales', async () => {
      const { snapshot, credentials } = await montar({
        SISCOUT_ENCRYPTION_KEY: clave(),
        SISCOUT_CREDENTIALS_KEY: clave(),
      });

      const contraseña = credentials.encrypt('secreta');

      expect(() => snapshot.decrypt(contraseña)).toThrow();
    });

    it('cada cifrador lee lo suyo', async () => {
      const { snapshot, credentials } = await montar({
        SISCOUT_ENCRYPTION_KEY: clave(),
        SISCOUT_CREDENTIALS_KEY: clave(),
      });

      expect(snapshot.decrypt(snapshot.encrypt('1013599123'))).toBe(
        '1013599123',
      );
      expect(credentials.decrypt(credentials.encrypt('secreta'))).toBe(
        'secreta',
      );
    });
  });

  describe('claves ausentes', () => {
    it('arranca sin ninguna clave y deja los cifradores inutilizables', async () => {
      const { snapshot, credentials } = await montar({});

      expect(snapshot.isReady()).toBe(false);
      expect(credentials.isReady()).toBe(false);
      expect(() => snapshot.encrypt('dato')).toThrow(
        /SISCOUT_ENCRYPTION_KEY no está configurada/,
      );
      expect(() => credentials.encrypt('dato')).toThrow(
        /SISCOUT_CREDENTIALS_KEY no está configurada/,
      );
    });

    it('una clave presente no habilita a la otra', async () => {
      const { snapshot, credentials } = await montar({
        SISCOUT_ENCRYPTION_KEY: clave(),
      });

      expect(snapshot.isReady()).toBe(true);
      expect(credentials.isReady()).toBe(false);
    });
  });

  it('admite un conjunto de claves rotadas por variable', async () => {
    const anterior = clave();

    const primero = await montar({ SISCOUT_CREDENTIALS_KEY: anterior });
    const guardado = primero.credentials.encrypt('secreta');

    const tras = await montar({
      SISCOUT_CREDENTIALS_KEY: `v2:${clave()},v1:${anterior}`,
    });

    expect(tras.credentials.decrypt(guardado)).toBe('secreta');
    expect(tras.credentials.encrypt('otra').kid).toBe('v2');
  });

  it('no arranca con una clave que no decodifica a 32 bytes', async () => {
    await expect(
      montar({ SISCOUT_ENCRYPTION_KEY: randomBytes(16).toString('base64') }),
    ).rejects.toThrow(/decodifica a 16 bytes, y deben ser 32/);
  });
});
