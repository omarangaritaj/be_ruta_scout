import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AppBadRequestException } from '../common';
import { CurrentUserService } from '../current-user/current-user.service';
import { Role } from './schemas/role.schema';
import { RolesService } from './roles.service';

type RoleDoc = Record<string, unknown> & {
  _id: Types.ObjectId;
  save: jest.Mock;
  deleteOne: jest.Mock;
};

/**
 * Imita una Query de Mongoose: solo `.exec()`, que es lo unico que
 * `roles.service.ts` invoca tras `findById`/`findOne`. Resuelve al valor
 * dado, nunca al propio objeto: un doble que no resolviera a `result` (por
 * ejemplo devolviendo `this`, siempre truthy) dejaria pasar cualquier guarda
 * montada sobre el resultado aunque el codigo real la rompiera.
 */
function chain<T>(result: T): { exec: jest.Mock<Promise<T>, unknown[]> } {
  return { exec: jest.fn(() => Promise.resolve(result)) };
}

function makeRole(overrides: Record<string, unknown> = {}): RoleDoc {
  const role: RoleDoc = {
    _id: new Types.ObjectId(),
    nombre: 'colaborador',
    permissions: [],
    resources: [],
    status: 'activo',
    esSistema: false,
    save: jest.fn(),
    deleteOne: jest.fn(() => Promise.resolve()),
    ...overrides,
  };
  role.save.mockImplementation(() => Promise.resolve(role));
  return role;
}

describe('RolesService', () => {
  let service: RolesService;
  let roleModel: {
    findById: jest.Mock;
    findOne: jest.Mock;
  };
  let currentUser: { refreshByRole: jest.Mock };

  beforeEach(async () => {
    roleModel = {
      findById: jest.fn(),
      findOne: jest.fn(() => chain(null)),
    };
    currentUser = { refreshByRole: jest.fn(() => Promise.resolve()) };

    const module = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: CurrentUserService, useValue: currentUser },
      ],
    }).compile();

    service = module.get(RolesService);
  });

  describe('update', () => {
    it('persiste resources cuando el PATCH los incluye', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));

      await service.update(role._id.toString(), { resources: ['/units'] });

      expect(role.resources).toEqual(['/units']);
      expect(role.save).toHaveBeenCalledTimes(1);
    });

    it('persiste permissions cuando el PATCH los incluye', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));

      await service.update(role._id.toString(), {
        permissions: ['unit:read'],
      });

      expect(role.permissions).toEqual(['unit:read']);
      expect(role.save).toHaveBeenCalledTimes(1);
    });

    it('un rol de sistema rechaza el cambio de resources', async () => {
      const role = makeRole({ esSistema: true, resources: ['*'] });
      roleModel.findById.mockReturnValue(chain(role));

      await expect(
        service.update(role._id.toString(), { resources: ['/units'] }),
      ).rejects.toBeInstanceOf(AppBadRequestException);

      expect(role.resources).toEqual(['*']);
      expect(role.save).not.toHaveBeenCalled();
      expect(currentUser.refreshByRole).not.toHaveBeenCalled();
    });

    it('un rol de sistema rechaza el cambio de permissions', async () => {
      const role = makeRole({ esSistema: true, permissions: ['*'] });
      roleModel.findById.mockReturnValue(chain(role));

      await expect(
        service.update(role._id.toString(), { permissions: ['unit:read'] }),
      ).rejects.toBeInstanceOf(AppBadRequestException);

      expect(role.permissions).toEqual(['*']);
      expect(role.save).not.toHaveBeenCalled();
      expect(currentUser.refreshByRole).not.toHaveBeenCalled();
    });

    it('un PATCH sin resources ni permissions no los toca', async () => {
      const role = makeRole({
        permissions: ['unit:read'],
        resources: ['/units'],
      });
      roleModel.findById.mockReturnValue(chain(role));

      await service.update(role._id.toString(), { descripcion: 'nueva' });

      expect(role.permissions).toEqual(['unit:read']);
      expect(role.resources).toEqual(['/units']);
      expect(role.descripcion).toBe('nueva');
    });
  });
});
