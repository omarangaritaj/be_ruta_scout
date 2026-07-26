import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { AuthService } from './auth.service';

const hasher = { hash: (c: string) => `H:${c}`, isReady: () => true };
const jwt = { signAsync: jest.fn(() => Promise.resolve('access.jwt')) };
const config = { get: jest.fn(() => 30) };

function makeService(opts: { user?: unknown; refreshDoc?: unknown } = {}) {
  const userModel = {
    findOne: () => ({ exec: () => Promise.resolve(opts.user ?? null) }),
    findById: () => ({ exec: () => Promise.resolve(opts.user ?? null) }),
  };
  const refreshModel = {
    create: jest.fn((doc: unknown) => Promise.resolve(doc)),
    findOne: () => ({ exec: () => Promise.resolve(opts.refreshDoc ?? null) }),
    updateOne: () => ({ exec: () => Promise.resolve({}) }),
  };
  const permissions = {
    effectivePermissions: jest.fn(() => Promise.resolve(new Set<string>())),
  };
  const svc = new AuthService(
    userModel as never,
    refreshModel as never,
    hasher as never,
    jwt as never,
    config as never,
    permissions as never,
  );
  return { svc, refreshModel };
}

const base = {
  _id: 'abc',
  name: 'Ana',
  tipo: 'adulto',
  estadoAcceso: 'sin_solicitud',
};

describe('AuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('check', () => {
    it('cédula desconocida → inactive', async () => {
      const { svc } = makeService({ user: null });
      expect((await svc.check('9')).status).toBe('inactive');
    });

    it('persona sin contraseña → new', async () => {
      const { svc } = makeService({ user: { ...base } });
      expect((await svc.check('1')).status).toBe('new');
    });

    it('persona con contraseña → registered', async () => {
      const { svc } = makeService({ user: { ...base, passwordHash: 'x' } });
      const r = await svc.check('1');
      expect(r.status).toBe('registered');
      expect(r.person?.name).toBe('Ana');
    });
  });

  describe('powersyncToken', () => {
    it('emite un token con audiencia powersync para un usuario aprobado', async () => {
      const { svc } = makeService({
        user: { ...base, estadoAcceso: 'aprobado' },
      });
      const res = await svc.powersyncToken('abc');
      expect(res.token).toBe('access.jwt');
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { sub: 'abc' },
        expect.objectContaining({ audience: 'powersync' }),
      );
    });

    it('rechaza a quien no tiene acceso aprobado', async () => {
      const { svc } = makeService({
        user: { ...base, estadoAcceso: 'pendiente' },
      });
      await expect(svc.powersyncToken('abc')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('falla si el usuario ya no existe', async () => {
      const { svc } = makeService({ user: null });
      await expect(svc.powersyncToken('abc')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('validateCredentials', () => {
    it('sin cuenta → Unauthorized', async () => {
      const { svc } = makeService({ user: null });
      await expect(svc.validateCredentials('1', 'x')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('contraseña incorrecta → Unauthorized', async () => {
      const passwordHash = await hash('correcta', 4);
      const { svc } = makeService({ user: { ...base, passwordHash } });
      await expect(
        svc.validateCredentials('1', 'incorrecta'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('contraseña correcta → devuelve el usuario', async () => {
      const passwordHash = await hash('correcta', 4);
      const { svc } = makeService({ user: { ...base, passwordHash } });
      const u = await svc.validateCredentials('1', 'correcta');
      expect(u).toMatchObject({ name: 'Ana' });
    });
  });

  describe('register', () => {
    it('cédula fuera de SiScout → NotFound', async () => {
      const { svc } = makeService({ user: null });
      await expect(svc.register('1', 'password1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('cuenta ya existente → Conflict', async () => {
      const { svc } = makeService({ user: { ...base, passwordHash: 'x' } });
      await expect(svc.register('1', 'password1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('crea la cuenta, fija el hash y emite tokens', async () => {
      const save = jest.fn(() => Promise.resolve());
      const user: typeof base & {
        save: jest.Mock;
        passwordHash?: string;
      } = { ...base, save };
      const { svc, refreshModel } = makeService({ user });
      const r = await svc.register('1', 'password1');
      expect(user.passwordHash).toBeDefined();
      expect(save).toHaveBeenCalled();
      expect(r.accessToken).toBe('access.jwt');
      expect(typeof r.refreshToken).toBe('string');
      expect(refreshModel.create).toHaveBeenCalled();
      expect(r.nextStep).toBe('onboarding');
    });
  });

  describe('login → nextStep', () => {
    it('aprobado → app', async () => {
      const { svc } = makeService();
      const r = await svc.login({ ...base, estadoAcceso: 'aprobado' } as never);
      expect(r.nextStep).toBe('app');
    });

    it('suspendido → suspended', async () => {
      const { svc } = makeService();
      const r = await svc.login({
        ...base,
        estadoAcceso: 'suspendido',
      } as never);
      expect(r.nextStep).toBe('suspended');
    });

    it('sin_solicitud → onboarding', async () => {
      const { svc } = makeService();
      const r = await svc.login({ ...base } as never);
      expect(r.nextStep).toBe('onboarding');
    });
  });

  describe('refresh', () => {
    it('token inexistente → Unauthorized', async () => {
      const { svc } = makeService({ refreshDoc: null });
      await expect(svc.refresh('tok')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('token revocado → Unauthorized', async () => {
      const refreshDoc = {
        revoked: true,
        expiresAt: new Date(Date.now() + 10_000),
        save: jest.fn(),
      };
      const { svc } = makeService({ refreshDoc });
      await expect(svc.refresh('tok')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('token válido → rota y emite nuevos tokens', async () => {
      const save = jest.fn(() => Promise.resolve());
      const refreshDoc = {
        revoked: false,
        expiresAt: new Date(Date.now() + 100_000),
        userId: 'abc',
        save,
      };
      const user = { ...base, estadoAcceso: 'aprobado' };
      const { svc, refreshModel } = makeService({ user, refreshDoc });
      const r = await svc.refresh('tok');
      expect(refreshDoc.revoked).toBe(true);
      expect(save).toHaveBeenCalled();
      expect(refreshModel.create).toHaveBeenCalled();
      expect(r.accessToken).toBe('access.jwt');
      expect(r.nextStep).toBe('app');
    });
  });
});
