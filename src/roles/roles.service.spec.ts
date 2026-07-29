import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EscalationService } from '../authz/escalation.service';
import { PermissionsService } from '../authz/permissions.service';
import {
  AppBadRequestException,
  AppConflictException,
  AppForbiddenException,
  AppNotFoundException,
} from '../common';
import { CurrentUserService } from '../current-user/current-user.service';
import { User } from '../users/schemas/user.schema';
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

/** `countDocuments(...).session(...).exec()`, que es como cuenta el servicio. */
function countChain(total: number): { session: jest.Mock } {
  return { session: jest.fn(() => chain(total)) };
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
    deleteOne: jest.Mock;
  };
  let userModel: {
    countDocuments: jest.Mock;
    find: jest.Mock;
    updateMany: jest.Mock;
  };
  let connection: { startSession: jest.Mock };
  let currentUser: { refreshByRole: jest.Mock };
  /** Poderes del actor. Se reemplazan por test; por defecto lo puede todo. */
  let actorPermissions: Set<string>;
  let actorResources: Set<string>;
  /** Cuántas personas tienen el rol. Se reemplaza por test. */
  let holders: number;

  beforeEach(async () => {
    roleModel = {
      findById: jest.fn(),
      findOne: jest.fn(() => chain(null)),
      create: jest.fn((dto: unknown) => Promise.resolve(dto)),
      find: jest.fn(() => chain([])),
      deleteOne: jest.fn(() => chain({ deletedCount: 1 })),
    };
    holders = 0;
    userModel = {
      countDocuments: jest.fn(() => countChain(holders)),
      find: jest.fn(() => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({ populate: () => chain([]) }),
          }),
        }),
      })),
      updateMany: jest.fn(() => chain({ modifiedCount: 1 })),
    };
    connection = {
      startSession: jest.fn(() =>
        Promise.resolve({
          withTransaction: (work: () => Promise<unknown>) => work(),
          endSession: jest.fn(() => Promise.resolve()),
        }),
      ),
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
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getConnectionToken(), useValue: connection },
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

  describe('remove', () => {
    it('rechaza el borrado si alguien tiene el rol', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));
      holders = 3;

      await expect(service.remove(role._id.toString())).rejects.toBeInstanceOf(
        AppConflictException,
      );

      expect(role.deleteOne).not.toHaveBeenCalled();
      expect(currentUser.refreshByRole).not.toHaveBeenCalled();
    });

    it('el mensaje dice CUÁNTAS personas lo tienen', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));
      holders = 7;

      await expect(service.remove(role._id.toString())).rejects.toThrow(/7/);
    });

    it('borra cuando no lo tiene nadie', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));
      holders = 0;

      await service.remove(role._id.toString());

      expect(role.deleteOne).toHaveBeenCalledTimes(1);
      expect(currentUser.refreshByRole).toHaveBeenCalledTimes(1);
    });

    it('un rol de sistema se rechaza antes de contar a nadie', async () => {
      const role = makeRole({ esSistema: true });
      roleModel.findById.mockReturnValue(chain(role));

      await expect(service.remove(role._id.toString())).rejects.toBeInstanceOf(
        AppBadRequestException,
      );

      expect(userModel.countDocuments).not.toHaveBeenCalled();
    });
  });

  describe('reassignAndRemove', () => {
    const TARGET = new Types.ObjectId();
    const OTHER_TARGET = new Types.ObjectId();

    /** Los roles destino existen y no conceden nada fuera de lo corriente. */
    function targetsExist(...ids: Types.ObjectId[]): void {
      roleModel.find.mockReturnValue(
        chain(
          ids.map((_id) => ({
            _id,
            permissions: ['unit:read'],
            resources: [],
          })),
        ),
      );
    }

    it('reasigna y borra el rol en la misma transacción', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));
      targetsExist(TARGET);
      holders = 0;

      await service.reassignAndRemove(ACTOR, role._id.toString(), {
        reassignments: [{ userId: new Types.ObjectId(), targetRoleId: TARGET }],
      });

      expect(userModel.updateMany).toHaveBeenCalledTimes(1);
      expect(roleModel.deleteOne).toHaveBeenCalledTimes(1);
      expect(currentUser.refreshByRole).toHaveBeenCalledTimes(1);
    });

    it('agrupa por destino: una escritura por rol, no por persona', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));
      targetsExist(TARGET, OTHER_TARGET);
      holders = 0;

      await service.reassignAndRemove(ACTOR, role._id.toString(), {
        reassignments: [
          { userId: new Types.ObjectId(), targetRoleId: TARGET },
          { userId: new Types.ObjectId(), targetRoleId: TARGET },
          { userId: new Types.ObjectId(), targetRoleId: TARGET },
          { userId: new Types.ObjectId(), targetRoleId: OTHER_TARGET },
        ],
      });

      expect(userModel.updateMany).toHaveBeenCalledTimes(2);
    });

    it('NO borra si al recontar todavía queda alguien con el rol', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));
      targetsExist(TARGET);
      // Alguien recibió el rol entre que se abrió el diálogo y se confirmó.
      holders = 1;

      await expect(
        service.reassignAndRemove(ACTOR, role._id.toString(), {
          reassignments: [
            { userId: new Types.ObjectId(), targetRoleId: TARGET },
          ],
        }),
      ).rejects.toBeInstanceOf(AppConflictException);

      expect(roleModel.deleteOne).not.toHaveBeenCalled();
      expect(currentUser.refreshByRole).not.toHaveBeenCalled();
    });

    it('rechaza reasignar al mismo rol que se va a eliminar', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));

      await expect(
        service.reassignAndRemove(ACTOR, role._id.toString(), {
          reassignments: [
            { userId: new Types.ObjectId(), targetRoleId: role._id },
          ],
        }),
      ).rejects.toBeInstanceOf(AppBadRequestException);

      expect(userModel.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza un rol destino que no existe', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));
      roleModel.find.mockReturnValue(chain([]));

      await expect(
        service.reassignAndRemove(ACTOR, role._id.toString(), {
          reassignments: [
            { userId: new Types.ObjectId(), targetRoleId: TARGET },
          ],
        }),
      ).rejects.toBeInstanceOf(AppNotFoundException);

      expect(userModel.updateMany).not.toHaveBeenCalled();
    });

    it('nadie reparte un rol que concede más de lo que él tiene', async () => {
      actorPermissions = new Set(['unit:read']);
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));
      roleModel.find.mockReturnValue(
        chain([{ _id: TARGET, permissions: ['*'], resources: [] }]),
      );

      await expect(
        service.reassignAndRemove(ACTOR, role._id.toString(), {
          reassignments: [
            { userId: new Types.ObjectId(), targetRoleId: TARGET },
          ],
        }),
      ).rejects.toBeInstanceOf(AppForbiddenException);

      expect(userModel.updateMany).not.toHaveBeenCalled();
      expect(roleModel.deleteOne).not.toHaveBeenCalled();
    });

    it('sin reasignaciones borra el rol si ya no lo tiene nadie', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));
      holders = 0;

      await service.reassignAndRemove(ACTOR, role._id.toString(), {
        reassignments: [],
      });

      expect(userModel.updateMany).not.toHaveBeenCalled();
      expect(roleModel.deleteOne).toHaveBeenCalledTimes(1);
    });

    it('el destino por defecto barre a quien no venía nombrado', async () => {
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));
      targetsExist(TARGET);
      holders = 0;

      await service.reassignAndRemove(ACTOR, role._id.toString(), {
        defaultTargetRoleId: TARGET,
        reassignments: [],
      });

      // Sin lista de ids: el filtro alcanza a cualquiera que tenga el rol.
      const [filter] = userModel.updateMany.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(filter).toEqual({ roles: role._id });
      expect(roleModel.deleteOne).toHaveBeenCalledTimes(1);
    });

    it('los destinos nominales corren ANTES que el barrido por defecto', async () => {
      const role = makeRole();
      const namedUser = new Types.ObjectId();
      roleModel.findById.mockReturnValue(chain(role));
      targetsExist(TARGET, OTHER_TARGET);
      holders = 0;

      await service.reassignAndRemove(ACTOR, role._id.toString(), {
        defaultTargetRoleId: OTHER_TARGET,
        reassignments: [{ userId: namedUser, targetRoleId: TARGET }],
      });

      const [first, second] = userModel.updateMany.mock.calls as [
        [Record<string, unknown>],
        [Record<string, unknown>],
      ];
      expect(first[0]).toMatchObject({ _id: { $in: [namedUser] } });
      expect(second[0]).toEqual({ roles: role._id });
    });

    it('el destino por defecto también pasa por el control de escalada', async () => {
      actorPermissions = new Set(['unit:read']);
      const role = makeRole();
      roleModel.findById.mockReturnValue(chain(role));
      roleModel.find.mockReturnValue(
        chain([{ _id: TARGET, permissions: ['*'], resources: [] }]),
      );

      await expect(
        service.reassignAndRemove(ACTOR, role._id.toString(), {
          defaultTargetRoleId: TARGET,
          reassignments: [],
        }),
      ).rejects.toBeInstanceOf(AppForbiddenException);

      expect(userModel.updateMany).not.toHaveBeenCalled();
    });
  });
});
