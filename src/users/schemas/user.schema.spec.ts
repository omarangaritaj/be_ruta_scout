import { model } from 'mongoose';
import { User, UserSchema } from './user.schema';

const UserModel = model<User>('UserAccesoTest', UserSchema);

describe('User — campos de acceso', () => {
  const base = { name: 'Ana', tipo: 'adulto', idSiscout: 'X' } as const;

  it('estadoAcceso por defecto es sin_solicitud', () => {
    expect(new UserModel(base).estadoAcceso).toBe('sin_solicitud');
  });

  it('rechaza un nivelAcceso fuera del enum', () => {
    const u = new UserModel({ ...base, nivelAcceso: 'planeta' });
    expect(u.validateSync()?.errors.nivelAcceso).toBeDefined();
  });

  it('acepta rama como nivelAcceso', () => {
    const u = new UserModel({ ...base, nivelAcceso: 'rama' });
    expect(u.validateSync()?.errors.nivelAcceso).toBeUndefined();
  });

  it('rechaza un estadoAcceso fuera del enum', () => {
    const u = new UserModel({ ...base, estadoAcceso: 'inventado' });
    expect(u.validateSync()?.errors.estadoAcceso).toBeDefined();
  });
});
