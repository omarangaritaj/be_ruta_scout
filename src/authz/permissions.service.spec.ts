import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { User } from '../users/schemas/user.schema';
import { PermissionsService } from './permissions.service';

/**
 * Imita una Query de Mongoose: solo `.exec()`, que es lo único que el servicio
 * invoca. Resuelve al valor dado, nunca al propio objeto (siempre truthy).
 * Mismo helper que `roles.service.spec.ts`.
 */
function chain<T>(result: T): { exec: jest.Mock<Promise<T>, unknown[]> } {
  return { exec: jest.fn(() => Promise.resolve(result)) };
}

describe('PermissionsService.effectiveLevel', () => {
  let service: PermissionsService;
  let userModel: { findById: jest.Mock };
  let userInDb: { nivelAcceso?: string } | null;

  beforeEach(async () => {
    userInDb = null;
    userModel = { findById: jest.fn(() => chain(userInDb)) };

    const module = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: getModelToken(User.name), useValue: userModel },
      ],
    }).compile();

    service = module.get(PermissionsService);
  });

  it('devuelve el nivel del usuario', async () => {
    userInDb = { nivelAcceso: 'region' };

    await expect(service.effectiveLevel('actor')).resolves.toBe('region');
  });

  it('sin nivel asignado devuelve undefined', async () => {
    userInDb = {};

    await expect(service.effectiveLevel('actor')).resolves.toBeUndefined();
  });

  it('si el usuario ya no existe devuelve undefined: falla cerrado', async () => {
    userInDb = null;

    await expect(service.effectiveLevel('fantasma')).resolves.toBeUndefined();
  });

  it('solo pide el campo del nivel, no el documento entero', async () => {
    await service.effectiveLevel('actor');

    expect(userModel.findById).toHaveBeenCalledWith('actor', 'nivelAcceso');
  });
});
