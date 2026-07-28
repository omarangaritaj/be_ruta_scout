import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import type { ListUsersDto } from './dto/list-users.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import { EscalationService } from '../authz/escalation.service';
import { PermissionsService } from '../authz/permissions.service';
import { CurrentUserService } from '../current-user/current-user.service';
import { Role } from '../roles/schemas/role.schema';
import { User } from './schemas/user.schema';
import { UsersService } from './users.service';

type FindChain = Record<
  'sort' | 'skip' | 'limit' | 'populate' | 'exec',
  jest.Mock
>;

/**
 * Cadena `find().sort().skip().limit().populate().exec()`. Todos los eslabones
 * devuelven la misma cadena salvo `exec`, que resuelve los items dados. Se
 * asigna eslabón a eslabón (no en el literal) para que `chain` tenga tipo y no
 * degrade a `any` por auto-referencia.
 */
function findChain(items: unknown[]): FindChain {
  const chain = {} as FindChain;
  chain.sort = jest.fn(() => chain);
  chain.skip = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.populate = jest.fn(() => chain);
  chain.exec = jest.fn(() => Promise.resolve(items));
  return chain;
}

interface ModelMock {
  find: jest.Mock<FindChain, [Record<string, unknown>]>;
  countDocuments: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
}

function baseFilters(overrides: Partial<ListUsersDto> = {}): ListUsersDto {
  return { page: 1, pageSize: 20, ...overrides };
}

describe('UsersService', () => {
  let service: UsersService;
  let model: ModelMock;
  /** Último filtro con el que se llamó a `find`, capturado por el mock. */
  let lastFilter: Record<string, unknown>;
  /** Roles que devuelve el modelo `Role` cuando se consulta lo que conceden. */
  let rolesInDb: { permissions: string[]; resources: string[] }[];
  let roleModel: { find: jest.Mock };
  /** Poderes del actor. Se reemplazan por test; por defecto lo puede todo. */
  let actorPermissions: Set<string>;
  let actorResources: Set<string>;
  let actorLevel: string | undefined;

  beforeEach(async () => {
    lastFilter = {};
    model = {
      find: jest.fn((filter: Record<string, unknown>) => {
        lastFilter = filter;
        return findChain([]);
      }),
      countDocuments: jest.fn(() => ({ exec: () => Promise.resolve(0) })),
      findById: jest.fn(() => ({ exec: () => Promise.resolve(null) })),
      create: jest.fn((dto: unknown) => Promise.resolve(dto)),
    };
    rolesInDb = [];
    actorPermissions = new Set(['*']);
    actorResources = new Set(['*']);
    actorLevel = 'super_admin';
    roleModel = {
      find: jest.fn(() => ({ exec: () => Promise.resolve(rolesInDb) })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        // El servicio real, no un doble: el test cubre así la comparación con
        // comodines de verdad, no solo que alguien sea invocado.
        EscalationService,
        { provide: getModelToken(User.name), useValue: model },
        { provide: getModelToken(Role.name), useValue: roleModel },
        {
          provide: CurrentUserService,
          useValue: { refresh: jest.fn(), invalidate: jest.fn() },
        },
        {
          provide: PermissionsService,
          useValue: {
            effectivePermissions: jest.fn(() =>
              Promise.resolve(actorPermissions),
            ),
            effectiveResources: jest.fn(() => Promise.resolve(actorResources)),
            effectiveLevel: jest.fn(() => Promise.resolve(actorLevel)),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('findAll', () => {
    it('sin filtros lista solo gestionables y excluye al super_admin', async () => {
      await service.findAll(baseFilters());

      const query = lastFilter;
      expect(query.estadoAcceso).toEqual({ $in: ['aprobado', 'suspendido'] });
      expect(query.nivelAcceso).toEqual({ $ne: 'super_admin' });
      expect(query).not.toHaveProperty('districtId');
      expect(query).not.toHaveProperty('name');
    });

    it('acota por estado, nivel y región cuando se piden', async () => {
      await service.findAll(
        baseFilters({ estado: 'suspendido', nivel: 'grupo', region: 8 }),
      );

      const query = lastFilter;
      expect(query.estadoAcceso).toBe('suspendido');
      expect(query.nivelAcceso).toBe('grupo');
      expect(query.districtId).toBe(8);
    });

    it('busca por nombre case-insensitive y escapa la regex', async () => {
      await service.findAll(baseFilters({ q: 'a.b*' }));

      const query = lastFilter as {
        name: { $regex: string; $options: string };
      };
      expect(query.name.$options).toBe('i');
      // Los metacaracteres quedan escapados: no es un comodín de regex.
      expect(query.name.$regex).toBe('a\\.b\\*');
    });

    it('devuelve items, total y la página pedida', async () => {
      model.find.mockReturnValue(findChain([{ name: 'Ana' }]));
      model.countDocuments.mockReturnValue({
        exec: () => Promise.resolve(42),
      });

      const result = await service.findAll(
        baseFilters({ page: 2, pageSize: 10 }),
      );

      expect(result.total).toBe(42);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.items).toHaveLength(1);
    });

    it('pagina con skip/limit según page y pageSize', async () => {
      const chain = findChain([]);
      model.find.mockReturnValue(chain);

      await service.findAll(baseFilters({ page: 3, pageSize: 15 }));

      expect(chain.skip).toHaveBeenCalledWith(30); // (3 - 1) * 15
      expect(chain.limit).toHaveBeenCalledWith(15);
    });
  });

  describe('update', () => {
    const accessChange: UpdateUserDto = { estadoAcceso: 'suspendido' };
    const OTHER_ROLE_ID = new Types.ObjectId('507f1f77bcf86cd799439011');

    function targetDoc(overrides: Record<string, unknown> = {}) {
      const doc = {
        nivelAcceso: 'grupo',
        set: jest.fn(),
        save: jest.fn(function (this: unknown) {
          return Promise.resolve(this);
        }),
        ...overrides,
      };
      return doc;
    }

    it('impide que un actor modifique su PROPIO acceso', async () => {
      await expect(
        service.update('user-1', 'user-1', accessChange),
      ).rejects.toBeInstanceOf(ForbiddenException);
      // Ni siquiera llega a leer el documento.
      expect(model.findById).not.toHaveBeenCalled();
    });

    it('impide que un actor cambie sus PROPIOS roles', async () => {
      await expect(
        service.update('user-1', 'user-1', { roles: [OTHER_ROLE_ID] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(model.findById).not.toHaveBeenCalled();
    });

    it('impide que un actor cambie sus PROPIOS cargos', async () => {
      await expect(
        service.update('user-1', 'user-1', {
          cargos: [{ nombreCargo: 'JEFE DE MANADA', nivel: 'rama' }],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(model.findById).not.toHaveBeenCalled();
    });

    it('permite editar datos NO de acceso sobre uno mismo', async () => {
      const doc = targetDoc();
      model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

      await expect(
        service.update('user-1', 'user-1', { name: 'Nuevo Nombre' }),
      ).resolves.toBe(doc);
      expect(doc.set).toHaveBeenCalledWith({ name: 'Nuevo Nombre' });
    });

    it('bloquea la gestión de un super_admin', async () => {
      model.findById.mockReturnValue({
        exec: () => Promise.resolve(targetDoc({ nivelAcceso: 'super_admin' })),
      });

      await expect(
        service.update('admin', 'target', accessChange),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lanza NotFound si el usuario no existe', async () => {
      model.findById.mockReturnValue({ exec: () => Promise.resolve(null) });

      await expect(
        service.update('admin', 'inexistente', accessChange),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('aplica y guarda los cambios de acceso de un usuario normal', async () => {
      const doc = targetDoc();
      model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

      await service.update('admin', 'target', accessChange);

      expect(doc.set).toHaveBeenCalledWith(accessChange);
      expect(doc.save).toHaveBeenCalled();
    });

    describe('no escalada de privilegios', () => {
      it('un actor sin * no puede asignar un rol que concede *', async () => {
        actorPermissions = new Set(['user:read', 'user:approve']);
        rolesInDb = [{ permissions: ['*'], resources: ['*'] }];
        const doc = targetDoc({ roles: [] });
        model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

        await expect(
          service.update('admin', 'target', { roles: [OTHER_ROLE_ID] }),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(doc.set).not.toHaveBeenCalled();
        expect(doc.save).not.toHaveBeenCalled();
      });

      it('un actor con * puede asignar el rol más poderoso', async () => {
        rolesInDb = [{ permissions: ['*'], resources: ['*'] }];
        const doc = targetDoc({ roles: [] });
        model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

        await service.update('admin', 'target', { roles: [OTHER_ROLE_ID] });

        expect(doc.save).toHaveBeenCalled();
      });

      it('un actor con unit:* puede asignar un rol que solo da unit:read', async () => {
        actorPermissions = new Set(['unit:*']);
        actorResources = new Set(['/units']);
        rolesInDb = [{ permissions: ['unit:read'], resources: ['/units'] }];
        const doc = targetDoc({ roles: [] });
        model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

        await service.update('admin', 'target', { roles: [OTHER_ROLE_ID] });

        expect(doc.save).toHaveBeenCalled();
      });

      it('un actor con unit:read no puede asignar un rol que da unit:*', async () => {
        actorPermissions = new Set(['unit:read']);
        rolesInDb = [{ permissions: ['unit:*'], resources: [] }];
        const doc = targetDoc({ roles: [] });
        model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

        await expect(
          service.update('admin', 'target', { roles: [OTHER_ROLE_ID] }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('QUITARLE a alguien un rol que el actor no tiene SÍ se permite', async () => {
        actorPermissions = new Set(['user:approve']);
        actorResources = new Set(['/admin/usuarios']);
        const doc = targetDoc({ roles: [OTHER_ROLE_ID] });
        model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

        await service.update('admin', 'target', { roles: [] });

        expect(doc.save).toHaveBeenCalled();
        // Ni siquiera consulta qué concedía: quitar nunca escala privilegios.
        expect(roleModel.find).not.toHaveBeenCalled();
      });

      it('un actor de nivel grupo NO puede conceder nacion', async () => {
        actorLevel = 'grupo';
        const doc = targetDoc({ nivelAcceso: 'rama' });
        model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

        await expect(
          service.update('admin', 'target', { nivelAcceso: 'nacion' }),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(doc.set).not.toHaveBeenCalled();
        expect(doc.save).not.toHaveBeenCalled();
      });

      it('un actor de nivel grupo tampoco puede conceder region', async () => {
        actorLevel = 'grupo';
        const doc = targetDoc({ nivelAcceso: 'rama' });
        model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

        await expect(
          service.update('admin', 'target', { nivelAcceso: 'region' }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('un actor de nivel nacion SÍ puede conceder region', async () => {
        actorLevel = 'nacion';
        const doc = targetDoc({ nivelAcceso: 'rama' });
        model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

        await service.update('admin', 'target', { nivelAcceso: 'region' });

        expect(doc.save).toHaveBeenCalled();
      });

      it('un actor SIN nivelAcceso no puede conceder ninguno', async () => {
        actorLevel = undefined;

        for (const nivel of ['rama', 'grupo', 'region', 'nacion'] as const) {
          const doc = targetDoc({ nivelAcceso: undefined });
          model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

          await expect(
            service.update('admin', 'target', { nivelAcceso: nivel }),
          ).rejects.toBeInstanceOf(ForbiddenException);
          expect(doc.save).not.toHaveBeenCalled();
        }
      });

      it('BAJAR el nivel de alguien SÍ se permite', async () => {
        actorLevel = 'grupo';
        const doc = targetDoc({ nivelAcceso: 'nacion' });
        model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

        await service.update('admin', 'target', { nivelAcceso: 'rama' });

        expect(doc.save).toHaveBeenCalled();
      });

      it('dejarle el nivel que ya tenía no cuenta como conceder', async () => {
        actorLevel = 'grupo';
        const doc = targetDoc({ nivelAcceso: 'nacion' });
        model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

        await service.update('admin', 'target', {
          nivelAcceso: 'nacion',
          name: 'Ana',
        });

        expect(doc.save).toHaveBeenCalled();
      });

      it('conservar los roles que ya tenía no cuenta como conceder', async () => {
        actorPermissions = new Set(['user:approve']);
        rolesInDb = [{ permissions: ['*'], resources: ['*'] }];
        const doc = targetDoc({ roles: [OTHER_ROLE_ID] });
        model.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

        await service.update('admin', 'target', {
          roles: [OTHER_ROLE_ID],
          name: 'Ana',
        });

        expect(doc.save).toHaveBeenCalled();
      });
    });
  });

  describe('create', () => {
    const ROLE_ID = new Types.ObjectId('507f1f77bcf86cd799439011');

    function adulto(roles: Types.ObjectId[]) {
      return {
        tipo: 'adulto' as const,
        name: 'Ana',
        idSiscout: '123',
        roles,
        cargos: [],
      };
    }

    it('un actor sin * no puede crear a alguien con un rol que concede *', async () => {
      actorPermissions = new Set(['user:approve']);
      rolesInDb = [{ permissions: ['*'], resources: [] }];

      await expect(
        service.create('admin', adulto([ROLE_ID])),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(model.create).not.toHaveBeenCalled();
    });

    it('un actor con * puede crear a alguien con ese mismo rol', async () => {
      rolesInDb = [{ permissions: ['*'], resources: [] }];

      await service.create('admin', adulto([ROLE_ID]));

      expect(model.create).toHaveBeenCalledTimes(1);
    });
  });
});
