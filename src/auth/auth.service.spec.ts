import { NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';

const hasher = { hash: (c: string) => `H:${c}`, isReady: () => true };

function service(user: unknown) {
  const userModel = { findOne: () => ({ exec: () => Promise.resolve(user) }) };
  return new AuthService(userModel as never, hasher as never);
}

describe('AuthService.login', () => {
  const base = { _id: 'abc', name: 'Ana', tipo: 'adulto' };

  it('aprobado → siguientePaso app', async () => {
    const r = await service({ ...base, estadoAcceso: 'aprobado' }).login('123');
    expect(r.siguientePaso).toBe('app');
    expect(r.persona.name).toBe('Ana');
  });

  it('pendiente → onboarding', async () => {
    const r = await service({ ...base, estadoAcceso: 'pendiente' }).login('1');
    expect(r.siguientePaso).toBe('onboarding');
  });

  it('sin_solicitud → onboarding', async () => {
    const r = await service({ ...base, estadoAcceso: 'sin_solicitud' }).login(
      '1',
    );
    expect(r.siguientePaso).toBe('onboarding');
  });

  it('suspendido → suspendido', async () => {
    const r = await service({ ...base, estadoAcceso: 'suspendido' }).login('1');
    expect(r.siguientePaso).toBe('suspendido');
  });

  it('cédula desconocida → NotFoundException', async () => {
    await expect(service(null).login('999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
