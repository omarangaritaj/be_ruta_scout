import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EscalationService } from '../authz/escalation.service';
import { PermissionsService } from '../authz/permissions.service';
import { AppBadRequestException, AppForbiddenException } from '../common';
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

const ACTOR = 'actor-1';

describe('RolesService', () => {
  let service: RolesService;
  let roleModel: {
    findById: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
  };
  let currentUser: { refreshByRole: jest.Mock };
  /** Poderes del actor. Se reemplazan por test; por defecto lo puede todo. */
  let actorPermissions: Set<string>;
  let actorResources: Set<string>;

  beforeEach(async () => {
    roleModel = {
      findById: jest.fn(),
      findOne: jest.fn(() => chain(null)),
      create: jest.fn((dto: unknown) => Promise.resolve(dto)),
      find: jest.fn(() => chain([])),
    };
    currentUser = { refreshByRole: jest.fn(() => Promise.resolve()) };
    actorPermissions = new Set(['*']);
    actorResources = new Set(['*']);

    const module = await Test.createTestingModule({
      providers: [
        RolesService,
        // El servicio real, no un doble: así el test cubre de verdad la
        // comparación con comodines y no solo que se llame a alguien.
        EscalationService,
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: CurrentUserService, useValue: currentUser },
        {
          provide: PermissionsService,
          useValue: {
            effectivePermissions: jest.fn(() =>
              Promise.resolve(actorPermissions),
            ),
            effectiveResources: jest.fn(() => Promise.resolve(actorResources)),
          },
        },
      ],
    }).compile();

    service = module.get(RolesService);
  });

  describe('update', () => {
    it('persiste resources cuando el PATCH los incluye', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));

      await service.update(ACTOR, role._id.toString(), {
        resources: ['/units'],
      });

      expect(role.resources).toEqual(['/units']);
      expect(role.save).toHaveBeenCalledTimes(1);
    });

    it('persiste permissions cuando el PATCH los incluye', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));

      await service.update(ACTOR, role._id.toString(), {
        permissions: ['unit:read'],
      });

      expect(role.permissions).toEqual(['unit:read']);
      expect(role.save).toHaveBeenCalledTimes(1);
    });

    it('un rol de sistema rechaza el cambio de resources', async () => {
      const role = makeRole({ esSistema: true, resources: ['*'] });
      roleModel.findById.mockReturnValue(chain(role));

      await expect(
        service.update(ACTOR, role._id.toString(), { resources: ['/units'] }),
      ).rejects.toBeInstanceOf(AppBadRequestException);

      expect(role.resources).toEqual(['*']);
      expect(role.save).not.toHaveBeenCalled();
      expect(currentUser.refreshByRole).not.toHaveBeenCalled();
    });

    it('un rol de sistema rechaza el cambio de permissions', async () => {
      const role = makeRole({ esSistema: true, permissions: ['*'] });
      roleModel.findById.mockReturnValue(chain(role));

      await expect(
        service.update(ACTOR, role._id.toString(), {
          permissions: ['unit:read'],
        }),
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

      await service.update(ACTOR, role._id.toString(), {
        descripcion: 'nueva',
      });

      expect(role.permissions).toEqual(['unit:read']);
      expect(role.resources).toEqual(['/units']);
      expect(role.descripcion).toBe('nueva');
    });
  });

  describe('no escalada de privilegios', () => {
    it('un actor sin * no puede crear un rol con *', async () => {
      actorPermissions = new Set(['unit:read']);

      await expect(
        service.create(ACTOR, {
          nombre: 'todopoderoso',
          permissions: ['*'],
          resources: [],
          status: 'activo',
        }),
      ).rejects.toBeInstanceOf(AppForbiddenException);

      expect(roleModel.create).not.toHaveBeenCalled();
    });

    it('un actor sin * no puede crear un rol con todas las páginas', async () => {
      actorResources = new Set(['/units']);

      await expect(
        service.create(ACTOR, {
          nombre: 'todopoderoso',
          permissions: [],
          resources: ['*'],
          status: 'activo',
        }),
      ).rejects.toBeInstanceOf(AppForbiddenException);

      expect(roleModel.create).not.toHaveBeenCalled();
    });

    it('el mensaje dice QUÉ falta, no un genérico', async () => {
      actorPermissions = new Set(['unit:read']);

      await expect(
        service.create(ACTOR, {
          nombre: 'todopoderoso',
          permissions: ['role:delete', '*'],
          resources: [],
          status: 'activo',
        }),
      ).rejects.toThrow(/role:delete, \*/);
    });

    it('un actor con unit:* SÍ puede conceder unit:read', async () => {
      actorPermissions = new Set(['unit:*']);
      actorResources = new Set(['/units']);

      await expect(
        service.create(ACTOR, {
          nombre: 'jefe de rama',
          permissions: ['unit:read'],
          resources: ['/units'],
          status: 'activo',
        }),
      ).resolves.toBeDefined();

      expect(roleModel.create).toHaveBeenCalledTimes(1);
    });

    it('un actor con unit:read NO puede conceder unit:*', async () => {
      actorPermissions = new Set(['unit:read']);

      await expect(
        service.create(ACTOR, {
          nombre: 'casi jefe',
          permissions: ['unit:*'],
          resources: [],
          status: 'activo',
        }),
      ).rejects.toBeInstanceOf(AppForbiddenException);
    });

    it('un actor con * puede conceder cualquier cosa', async () => {
      await expect(
        service.create(ACTOR, {
          nombre: 'otro admin',
          permissions: ['*'],
          resources: ['*'],
          status: 'activo',
        }),
      ).resolves.toBeDefined();
    });

    it('QUITAR un permiso que el actor no tiene SÍ se permite', async () => {
      actorPermissions = new Set(['unit:read']);
      actorResources = new Set(['/units']);
      const role = makeRole({
        permissions: ['role:delete', 'unit:read'],
        resources: ['/admin/roles', '/units'],
      });
      roleModel.findById.mockReturnValue(chain(role));

      await service.update(ACTOR, role._id.toString(), {
        permissions: ['unit:read'],
        resources: ['/units'],
      });

      expect(role.permissions).toEqual(['unit:read']);
      expect(role.save).toHaveBeenCalledTimes(1);
    });

    it('AÑADIR un permiso que el actor no tiene se rechaza', async () => {
      actorPermissions = new Set(['unit:read']);
      const role = makeRole({ permissions: ['unit:read'] });
      roleModel.findById.mockReturnValue(chain(role));

      await expect(
        service.update(ACTOR, role._id.toString(), {
          permissions: ['unit:read', 'role:delete'],
        }),
      ).rejects.toBeInstanceOf(AppForbiddenException);

      expect(role.permissions).toEqual(['unit:read']);
      expect(role.save).not.toHaveBeenCalled();
    });

    it('REACTIVAR un rol concede todo lo que lleva, no solo el delta', async () => {
      actorPermissions = new Set(['unit:read']);
      const role = makeRole({ status: 'inactivo', permissions: ['*'] });
      roleModel.findById.mockReturnValue(chain(role));

      await expect(
        service.update(ACTOR, role._id.toString(), { status: 'activo' }),
      ).rejects.toBeInstanceOf(AppForbiddenException);

      expect(role.save).not.toHaveBeenCalled();
    });
  });
});
