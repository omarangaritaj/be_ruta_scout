import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { ListUsersDto } from './dto/list-users.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
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
}

function baseFilters(overrides: Partial<ListUsersDto> = {}): ListUsersDto {
  return { page: 1, pageSize: 20, ...overrides };
}

describe('UsersService', () => {
  let service: UsersService;
  let model: ModelMock;
  /** Último filtro con el que se llamó a `find`, capturado por el mock. */
  let lastFilter: Record<string, unknown>;

  beforeEach(async () => {
    lastFilter = {};
    model = {
      find: jest.fn((filter: Record<string, unknown>) => {
        lastFilter = filter;
        return findChain([]);
      }),
      countDocuments: jest.fn(() => ({ exec: () => Promise.resolve(0) })),
      findById: jest.fn(() => ({ exec: () => Promise.resolve(null) })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: model },
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
  });
});
