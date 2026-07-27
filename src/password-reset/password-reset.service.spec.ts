import { BadRequestException, HttpException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { createHash } from 'node:crypto';
import { PasswordResetService } from './password-reset.service';

const TTL_MINUTES = 30;
const SITE_URL = 'https://ruta.test';

interface ResetEmail {
  to: string;
  nombre: string;
  url: string;
  minutos: number;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'user-1',
    name: 'Omar Angarita',
    idSiscout: '176035',
    passwordHash: 'hash-viejo',
    save: jest.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function makeService(
  opts: {
    user?: unknown;
    tokenDoc?: unknown;
    snapshot?: Record<string, unknown> | null;
    attempts?: number | null;
  } = {},
) {
  const user = 'user' in opts ? opts.user : makeUser();

  const userModel = {
    findOne: jest.fn(() => ({ exec: () => Promise.resolve(user ?? null) })),
    findById: jest.fn(() => ({ exec: () => Promise.resolve(user ?? null) })),
  };
  const tokenModel = {
    create: jest.fn((doc: unknown) => Promise.resolve(doc)),
    findOne: jest.fn(() => ({
      exec: () => Promise.resolve(opts.tokenDoc ?? null),
    })),
    deleteMany: jest.fn(() => ({ exec: () => Promise.resolve({}) })),
  };
  const refreshModel = {
    updateMany: jest.fn(() => ({ exec: () => Promise.resolve({}) })),
  };
  const cedulaHasher = { hash: (c: string) => `H:${c}`, isReady: () => true };
  const config = {
    get: jest.fn((key: string) =>
      key === 'SITE_URL' ? SITE_URL : TTL_MINUTES,
    ),
  };
  const email = {
    sendPasswordReset: jest.fn<Promise<void>, [ResetEmail]>(() =>
      Promise.resolve(),
    ),
  };
  const snapshots = {
    findDecrypted: jest.fn(() =>
      Promise.resolve(
        'snapshot' in opts
          ? opts.snapshot
          : { email: 'omar.angarita@expo.red' },
      ),
    ),
  };
  const redis = {
    get: jest.fn(() => Promise.resolve(opts.attempts ?? null)),
    set: jest.fn<Promise<void>, [string, unknown, number?]>(() =>
      Promise.resolve(),
    ),
    del: jest.fn<Promise<void>, [string]>(() => Promise.resolve()),
  };

  const svc = new PasswordResetService(
    userModel as never,
    tokenModel as never,
    refreshModel as never,
    cedulaHasher as never,
    config as never,
    email as never,
    snapshots as never,
    redis as never,
  );

  return { svc, userModel, tokenModel, refreshModel, email, redis, user };
}

/** Token que sigue vivo: sin consumir y con expiración en el futuro. */
function vivo(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    usedAt: null,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    save: jest.fn(() => Promise.resolve()),
    ...overrides,
  };
}

describe('PasswordResetService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('request', () => {
    it('cédula desconocida → not_found, sin correo', async () => {
      const { svc, email } = makeService({ user: null });
      expect(await svc.request('9')).toEqual({ status: 'not_found' });
      expect(email.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('persona sin contraseña → no_account (todavía no se ha registrado)', async () => {
      const { svc, email } = makeService({
        user: makeUser({ passwordHash: undefined }),
      });
      expect(await svc.request('1')).toEqual({ status: 'no_account' });
      expect(email.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('sin correo en el snapshot de SiScout → no_email', async () => {
      const { svc, email } = makeService({ snapshot: { nombre: 'Omar' } });
      expect(await svc.request('1')).toEqual({ status: 'no_email' });
      expect(email.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('envía el enlace y devuelve el correo enmascarado', async () => {
      const { svc, email } = makeService();

      expect(await svc.request('1')).toEqual({
        status: 'sent',
        emailMasked: 'om•••@expo.red',
      });

      const enviado = email.sendPasswordReset.mock.calls[0][0];
      expect(enviado.to).toBe('omar.angarita@expo.red');
      expect(enviado.nombre).toBe('Omar Angarita');
      expect(enviado.minutos).toBe(TTL_MINUTES);
      expect(enviado.url.startsWith(`${SITE_URL}/restablecer/`)).toBe(true);
    });

    it('guarda el hash del token, nunca el token que viaja al correo', async () => {
      const { svc, tokenModel, email } = makeService();
      await svc.request('1');

      const { url } = email.sendPasswordReset.mock.calls[0][0];
      const token = url.split('/restablecer/')[1];
      const guardado = tokenModel.create.mock.calls[0][0] as {
        tokenHash: string;
      };

      expect(token).toBeTruthy();
      expect(guardado.tokenHash).toBe(sha256(token));
      expect(guardado.tokenHash).not.toBe(token);
    });

    it('un enlace nuevo descarta los pendientes anteriores', async () => {
      const { svc, tokenModel } = makeService();
      await svc.request('1');
      expect(tokenModel.deleteMany).toHaveBeenCalledWith({
        userId: 'user-1',
        usedAt: null,
      });
    });

    it('pasado el límite de intentos responde 429 y no consulta nada', async () => {
      const { svc, userModel, email } = makeService({ attempts: 3 });

      await expect(svc.request('1')).rejects.toBeInstanceOf(HttpException);
      await expect(svc.request('1')).rejects.toMatchObject({ status: 429 });
      expect(userModel.findOne).not.toHaveBeenCalled();
      expect(email.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('cuenta el intento por el HMAC de la cédula, no por la cédula en claro', async () => {
      const { svc, redis } = makeService();
      await svc.request('79953510');

      const [key, valor] = redis.set.mock.calls[0];
      expect(key).toBe('password_reset_attempts:H:79953510');
      expect(key).not.toContain('79953510"');
      expect(valor).toBe(1);
    });
  });

  describe('check', () => {
    it('token inexistente → inválido', async () => {
      const { svc } = makeService({ tokenDoc: null });
      expect(await svc.check('x')).toEqual({ valid: false });
    });

    it('token ya usado → inválido', async () => {
      const { svc } = makeService({ tokenDoc: vivo({ usedAt: new Date() }) });
      expect(await svc.check('x')).toEqual({ valid: false });
    });

    it('token vencido → inválido', async () => {
      const { svc } = makeService({
        tokenDoc: vivo({ expiresAt: new Date(Date.now() - 1000) }),
      });
      expect(await svc.check('x')).toEqual({ valid: false });
    });

    it('token vivo → válido, con el nombre para saludar', async () => {
      const { svc } = makeService({ tokenDoc: vivo() });
      expect(await svc.check('x')).toEqual({
        valid: true,
        name: 'Omar Angarita',
      });
    });

    it('token vivo de una cuenta que ya no existe → inválido', async () => {
      const { svc } = makeService({ tokenDoc: vivo(), user: null });
      expect(await svc.check('x')).toEqual({ valid: false });
    });
  });

  describe('confirm', () => {
    it('token inválido → 400 y la contraseña no cambia', async () => {
      const { svc, user } = makeService({ tokenDoc: null });
      await expect(svc.confirm('x', 'NuevaClave123')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect((user as { save: jest.Mock }).save).not.toHaveBeenCalled();
    });

    it('guarda la contraseña hasheada, nunca en claro', async () => {
      const { svc, user } = makeService({ tokenDoc: vivo() });
      await svc.confirm('x', 'NuevaClave123');

      const guardado = user as { passwordHash: string; save: jest.Mock };
      expect(guardado.save).toHaveBeenCalled();
      expect(guardado.passwordHash).not.toBe('NuevaClave123');
      expect(await compare('NuevaClave123', guardado.passwordHash)).toBe(true);
    });

    it('marca el token como usado para que no sirva dos veces', async () => {
      const tokenDoc = vivo();
      const { svc } = makeService({ tokenDoc });
      await svc.confirm('x', 'NuevaClave123');

      expect(tokenDoc.usedAt).toBeInstanceOf(Date);
      expect(tokenDoc.save).toHaveBeenCalled();
    });

    it('revoca las sesiones abiertas y tira el perfil cacheado', async () => {
      const { svc, refreshModel, redis } = makeService({ tokenDoc: vivo() });
      await svc.confirm('x', 'NuevaClave123');

      expect(refreshModel.updateMany).toHaveBeenCalledWith(
        { userId: 'user-1', revoked: false },
        { $set: { revoked: true } },
      );
      expect(redis.del).toHaveBeenCalledWith('current_user:176035');
    });
  });
});
