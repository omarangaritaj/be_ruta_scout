import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUserService } from '../current-user/current-user.service';
import { K } from '../i18n';
import { User } from '../users/schemas/user.schema';
import { setMembersSchema } from './dto/set-members.dto';
import { updateUnitSchema } from './dto/update-unit.dto';
import { UnitMembership } from './schemas/unit-membership.schema';
import { Unit } from './schemas/unit.schema';
import { UnitsService } from './units.service';

type UnitDoc = Record<string, unknown> & {
  _id: Types.ObjectId;
  save: jest.Mock;
};

/**
 * Imita una Query de Mongoose: encadenable Y thenable.
 *
 * Lo segundo no es un adorno. `exists()` se consume con `await` directo
 * (`await model.exists(f).session(s)`), y un doble que solo expusiera
 * `.session()` resolvería al propio objeto —siempre truthy—, con lo que
 * cualquier guarda montada sobre `exists` pasaría el test aunque se borrara.
 */
interface QueryMock<T> {
  session: jest.Mock<QueryMock<T>, unknown[]>;
  sort: jest.Mock<QueryMock<T>, unknown[]>;
  select: jest.Mock<QueryMock<T>, unknown[]>;
  lean: jest.Mock<QueryMock<T>, unknown[]>;
  exec: jest.Mock<Promise<T>, unknown[]>;
  then: (
    resolve?: (value: T) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
}

function chain<T>(result: T): QueryMock<T> {
  const query: QueryMock<T> = {
    session: jest.fn(() => query),
    sort: jest.fn(() => query),
    select: jest.fn(() => query),
    lean: jest.fn(() => query),
    exec: jest.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

function makeSession() {
  return {
    withTransaction: jest.fn((work: () => Promise<unknown>) => work()),
    endSession: jest.fn(() => Promise.resolve()),
  };
}

function makeUnit(overrides: Record<string, unknown> = {}): UnitDoc {
  const unit: UnitDoc = {
    _id: new Types.ObjectId(),
    name: 'cambiar nombre unidad manada',
    branch: 'manada',
    groupId: 304,
    districtId: 12,
    districtName: 'Distrito Norte',
    city: 'Bogota',
    unitLeaderId: new Types.ObjectId(),
    leaders: [],
    members: [],
    configuredAt: undefined,
    save: jest.fn(),
    ...overrides,
  };
  unit.save.mockImplementation(() => Promise.resolve(unit));
  return unit;
}

const actor: AuthUser = { userId: 'actor', idSiscout: '99' };
const actorId = new Types.ObjectId();

const superAdmin = { _id: actorId.toString(), nivelAcceso: 'super_admin' };
const packLeader = (groupId: number) => ({
  _id: actorId.toString(),
  groupId,
  cargoSiscout: 'JEFE DE MANADA',
});
const groupLeader = (groupId: number) => ({
  _id: actorId.toString(),
  groupId,
  cargoSiscout: 'JEFE DE GRUPO',
});
const collaborator = (groupId: number) => ({
  _id: actorId.toString(),
  groupId,
  cargoSiscout: 'COLABORADOR DE GRUPO',
  cargos: [] as { nombreCargo: string; nivel: 'rama' }[],
});

function configureDto() {
  return {
    name: 'Manada Aullido',
    city: 'Bogota',
    unitLeaderId: new Types.ObjectId(),
    leaders: [],
  };
}

describe('UnitsService', () => {
  let service: UnitsService;
  let unitModel: {
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
    create: jest.Mock;
    exists: jest.Mock;
    find: jest.Mock;
  };
  let membershipModel: {
    deleteMany: jest.Mock;
    insertMany: jest.Mock;
    exists: jest.Mock;
  };
  let userModel: {
    updateMany: jest.Mock;
    updateOne: jest.Mock;
    countDocuments: jest.Mock;
    exists: jest.Mock;
    find: jest.Mock;
  };
  let currentUser: { get: jest.Mock; refresh: jest.Mock };

  beforeEach(async () => {
    unitModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(() => chain(null)),
      create: jest.fn(),
      exists: jest.fn(() => chain(false)),
      find: jest.fn(() => chain([])),
    };
    membershipModel = {
      deleteMany: jest.fn(() => Promise.resolve({})),
      insertMany: jest.fn(() => Promise.resolve([])),
      exists: jest.fn(() => chain(null)),
    };
    userModel = {
      updateMany: jest.fn(() => Promise.resolve({})),
      updateOne: jest.fn(() => chain({ modifiedCount: 1 })),
      countDocuments: jest.fn((filter: { _id: { $in: unknown[] } }) =>
        Promise.resolve(filter._id.$in.length),
      ),
      exists: jest.fn(() => chain(null)),
      find: jest.fn(() => chain([])),
    };
    const connection = {
      startSession: jest.fn(() => Promise.resolve(makeSession())),
    };
    currentUser = {
      get: jest.fn(() => Promise.resolve(superAdmin)),
      refresh: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UnitsService,
        { provide: getModelToken(Unit.name), useValue: unitModel },
        {
          provide: getModelToken(UnitMembership.name),
          useValue: membershipModel,
        },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getConnectionToken(), useValue: connection },
        { provide: CurrentUserService, useValue: currentUser },
      ],
    }).compile();

    service = module.get(UnitsService);
  });

  describe('alcance de las operaciones por id', () => {
    const operations: [string, (id: string) => Promise<unknown>][] = [
      ['findOne', (id) => service.findOne(actor, id)],
      ['configure', (id) => service.configure(actor, id, configureDto())],
      ['setMembers', (id) => service.setMembers(actor, id, [])],
      ['update', (id) => service.update(actor, id, { name: 'Otra' })],
      ['remove', (id) => service.remove(actor, id)],
    ];

    it.each(operations)(
      '%s rechaza una unidad de otro grupo sin tocar nada',
      async (_name, call) => {
        const unit = makeUnit({ groupId: 999, branch: 'manada' });
        unitModel.findById.mockReturnValue(chain(unit));
        currentUser.get.mockResolvedValue(groupLeader(304));

        await expect(call(unit._id.toString())).rejects.toBeInstanceOf(
          ForbiddenException,
        );

        expect(unit.save).not.toHaveBeenCalled();
        expect(unitModel.create).not.toHaveBeenCalled();
        expect(unitModel.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(unitModel.findByIdAndDelete).not.toHaveBeenCalled();
        expect(membershipModel.deleteMany).not.toHaveBeenCalled();
        expect(userModel.updateMany).not.toHaveBeenCalled();
      },
    );

    it.each(operations)(
      '%s rechaza otra rama del mismo grupo cuando el alcance es de rama',
      async (_name, call) => {
        const unit = makeUnit({ groupId: 304, branch: 'tropa' });
        unitModel.findById.mockReturnValue(chain(unit));
        currentUser.get.mockResolvedValue(packLeader(304));

        await expect(call(unit._id.toString())).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(membershipModel.deleteMany).not.toHaveBeenCalled();
      },
    );

    it('responde 403 con OUT_OF_SCOPE, no 404: la unidad existe', async () => {
      const unit = makeUnit({ groupId: 999 });
      unitModel.findById.mockReturnValue(chain(unit));
      currentUser.get.mockResolvedValue(groupLeader(304));

      await expect(
        service.findOne(actor, unit._id.toString()),
      ).rejects.toMatchObject({ code: K.UNITS.OUT_OF_SCOPE });
    });

    it('el alcance de grupo alcanza cualquier rama de su grupo', async () => {
      const unit = makeUnit({ groupId: 304, branch: 'tropa' });
      unitModel.findById.mockReturnValue(chain(unit));
      currentUser.get.mockResolvedValue(groupLeader(304));

      await expect(service.findOne(actor, unit._id.toString())).resolves.toBe(
        unit,
      );
      expect(membershipModel.exists).not.toHaveBeenCalled();
    });

    it('una fila en unit_memberships abre la unidad aunque el cargo no llegue', async () => {
      const unit = makeUnit({ groupId: 304, branch: 'tropa' });
      unitModel.findById.mockReturnValue(chain(unit));
      currentUser.get.mockResolvedValue(packLeader(304));
      membershipModel.exists.mockReturnValue(chain({ _id: 'm1' }));

      await expect(service.findOne(actor, unit._id.toString())).resolves.toBe(
        unit,
      );
      expect(membershipModel.exists).toHaveBeenCalledWith({
        unitId: unit._id,
        userId: actorId,
      });
    });

    it('una unidad inexistente sigue siendo 404', async () => {
      unitModel.findById.mockReturnValue(chain(null));

      await expect(
        service.findOne(actor, new Types.ObjectId().toString()),
      ).rejects.toMatchObject({ code: K.UNITS.NOT_FOUND });
    });
  });

  describe('configure', () => {
    it('excluye al jefe de la lista de subjefes aunque el cliente lo repita', async () => {
      const unit = makeUnit();
      unitModel.findById.mockReturnValue(chain(unit));

      const leaderHex = new Types.ObjectId().toString();
      const otherHex = new Types.ObjectId().toString();
      const dto = {
        name: 'Manada Aullido',
        city: 'Bogota',
        unitLeaderId: new Types.ObjectId(leaderHex),
        leaders: [new Types.ObjectId(leaderHex), new Types.ObjectId(otherHex)],
      };

      await service.configure(actor, unit._id.toString(), dto);

      const leaderIds = (unit.leaders as Types.ObjectId[]).map((id) =>
        id.toString(),
      );
      expect(leaderIds).toEqual([otherHex]);
    });

    it('rechaza un jefe que no sea adulto activo del grupo de la unidad', async () => {
      const unit = makeUnit();
      unitModel.findById.mockReturnValue(chain(unit));
      userModel.countDocuments.mockResolvedValue(0);

      await expect(
        service.configure(actor, unit._id.toString(), configureDto()),
      ).rejects.toMatchObject({ code: K.UNITS.LEADER_NOT_ELIGIBLE });
      expect(unit.save).not.toHaveBeenCalled();
    });

    it('exige que jefe y subjefes sean adultos activos del grupo de la unidad', async () => {
      const unit = makeUnit({ groupId: 304 });
      unitModel.findById.mockReturnValue(chain(unit));

      const leader = new Types.ObjectId();
      const assistant = new Types.ObjectId();
      await service.configure(actor, unit._id.toString(), {
        name: 'Manada Aullido',
        city: 'Bogota',
        unitLeaderId: leader,
        leaders: [assistant],
      });

      expect(userModel.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: { $in: [leader, assistant] },
          tipo: 'adulto',
          estado: true,
          groupId: 304,
        }),
        expect.anything(),
      );
    });

    it('rechaza un subjefe de otro grupo aunque el jefe sí valga', async () => {
      const unit = makeUnit();
      unitModel.findById.mockReturnValue(chain(unit));
      userModel.countDocuments.mockResolvedValue(1);

      await expect(
        service.configure(actor, unit._id.toString(), {
          name: 'Manada Aullido',
          city: 'Bogota',
          unitLeaderId: new Types.ObjectId(),
          leaders: [new Types.ObjectId()],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('setMembers', () => {
    it('con lista vacia sobre una unidad con miembros, la clon se lleva a todos y el origen queda vacio', async () => {
      const first = new Types.ObjectId();
      const second = new Types.ObjectId();
      const unit = makeUnit({ members: [first, second] });
      unitModel.findById.mockReturnValue(chain(unit));

      let clone: Record<string, unknown> | undefined;
      unitModel.create.mockImplementation((docs: Record<string, unknown>[]) => {
        clone = { ...docs[0], _id: new Types.ObjectId() };
        return Promise.resolve([clone]);
      });

      const result = await service.setMembers(actor, unit._id.toString(), []);

      expect(unitModel.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(unit.members).toEqual([]);
      expect((clone?.members as Types.ObjectId[]).map(String).sort()).toEqual(
        [first.toString(), second.toString()].sort(),
      );
    });

    it('con lista vacia sobre una unidad ya vacia, no crea ninguna clon', async () => {
      const unit = makeUnit({ members: [] });
      unitModel.findById.mockReturnValue(chain(unit));

      const result = await service.setMembers(actor, unit._id.toString(), []);

      expect(unitModel.create).not.toHaveBeenCalled();
      expect(result).toEqual([unit]);
    });

    it('rechaza un id ajeno a la unidad con MEMBERS_NOT_IN_UNIT', async () => {
      const unit = makeUnit({ members: [new Types.ObjectId()] });
      const outsider = new Types.ObjectId();
      unitModel.findById.mockReturnValue(chain(unit));

      await expect(
        service.setMembers(actor, unit._id.toString(), [outsider.toString()]),
      ).rejects.toMatchObject({ code: K.UNITS.MEMBERS_NOT_IN_UNIT });
    });

    it('crea una unidad clon con los salientes, nombre distinto y sin configuredAt', async () => {
      const staying = new Types.ObjectId();
      const leaving = new Types.ObjectId();
      const unit = makeUnit({ members: [staying, leaving] });
      unitModel.findById.mockReturnValue(chain(unit));

      let clone: Record<string, unknown> | undefined;
      unitModel.create.mockImplementation((docs: Record<string, unknown>[]) => {
        clone = { ...docs[0], _id: new Types.ObjectId() };
        return Promise.resolve([clone]);
      });

      const result = await service.setMembers(actor, unit._id.toString(), [
        staying.toString(),
      ]);

      expect(unitModel.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(clone?.name).not.toBe(unit.name);
      expect(clone?.configuredAt).toBeUndefined();
      expect((clone?.members as Types.ObjectId[]).map(String)).toEqual([
        leaving.toString(),
      ]);
    });

    it('deja a los salientes apuntando con unitId a la clon', async () => {
      const staying = new Types.ObjectId();
      const leaving = new Types.ObjectId();
      const unit = makeUnit({ members: [staying, leaving] });
      unitModel.findById.mockReturnValue(chain(unit));

      let clone: Record<string, unknown> | undefined;
      unitModel.create.mockImplementation((docs: Record<string, unknown>[]) => {
        clone = { ...docs[0], _id: new Types.ObjectId() };
        return Promise.resolve([clone]);
      });

      await service.setMembers(actor, unit._id.toString(), [
        staying.toString(),
      ]);

      expect(userModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [leaving] } },
        { $set: { unitId: clone?._id } },
        expect.anything(),
      );
      expect(userModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [staying] } },
        { $set: { unitId: unit._id } },
        expect.anything(),
      );
    });

    it('no crea ninguna unidad si nadie sale', async () => {
      const a = new Types.ObjectId();
      const b = new Types.ObjectId();
      const unit = makeUnit({ members: [a, b] });
      unitModel.findById.mockReturnValue(chain(unit));

      const result = await service.setMembers(actor, unit._id.toString(), [
        a.toString(),
        b.toString(),
      ]);

      expect(unitModel.create).not.toHaveBeenCalled();
      expect(result).toEqual([unit]);
    });

    it('no busca nombre libre para siempre: se rinde con NAME_EXHAUSTED', async () => {
      const leaving = new Types.ObjectId();
      const unit = makeUnit({ members: [leaving] });
      unitModel.findById.mockReturnValue(chain(unit));
      unitModel.exists.mockReturnValue(chain(true));

      await expect(
        service.setMembers(actor, unit._id.toString(), []),
      ).rejects.toMatchObject({ code: K.UNITS.NAME_EXHAUSTED });
      expect(unitModel.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('rechaza eliminar una unidad que todavia tiene protagonistas', async () => {
      const unit = makeUnit({ members: [new Types.ObjectId()] });
      unitModel.findById.mockReturnValue(chain(unit));

      await expect(
        service.remove(actor, unit._id.toString()),
      ).rejects.toMatchObject({
        code: K.UNITS.CANNOT_DELETE_WITH_MEMBERS,
      });
      expect(unitModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('elimina una unidad sin protagonistas y limpia unit_memberships y users.unitId', async () => {
      const unit = makeUnit({ members: [] });
      unitModel.findById.mockReturnValue(chain(unit));
      unitModel.findByIdAndDelete.mockReturnValue(chain(unit));

      await service.remove(actor, unit._id.toString());

      expect(unitModel.findByIdAndDelete).toHaveBeenCalledTimes(1);
      expect(membershipModel.deleteMany).toHaveBeenCalledWith(
        { unitId: unit._id },
        expect.anything(),
      );
      expect(membershipModel.insertMany).not.toHaveBeenCalled();
      expect(userModel.updateMany).toHaveBeenCalledWith(
        { unitId: unit._id },
        { $unset: { unitId: '' } },
        expect.anything(),
      );
    });
  });

  describe('update', () => {
    it('traduce la clave duplicada a NAME_TAKEN en vez de un error crudo de Mongo', async () => {
      const unit = makeUnit();
      unitModel.findById.mockReturnValue(chain(unit));
      const duplicateKeyError = Object.assign(
        new Error('E11000 duplicate key'),
        { code: 11000 },
      );
      unitModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn(() => Promise.reject(duplicateKeyError)),
      });

      await expect(
        service.update(actor, unit._id.toString(), { name: 'Ya existe' }),
      ).rejects.toMatchObject({ code: K.UNITS.NAME_TAKEN });
    });

    it('excluye al jefe de leaders cuando ambos llegan en el mismo PATCH', async () => {
      const unit = makeUnit();
      unitModel.findById.mockReturnValue(chain(unit));
      let receivedPatch: Record<string, unknown> | undefined;
      unitModel.findByIdAndUpdate.mockImplementation(
        (_id: string, patch: Record<string, unknown>) => {
          receivedPatch = patch;
          return chain({ ...unit, ...patch });
        },
      );

      const leaderHex = new Types.ObjectId().toString();
      const otherHex = new Types.ObjectId().toString();

      await service.update(actor, unit._id.toString(), {
        unitLeaderId: new Types.ObjectId(leaderHex),
        leaders: [new Types.ObjectId(leaderHex), new Types.ObjectId(otherHex)],
      });

      const leaderIds = (receivedPatch?.leaders as Types.ObjectId[]).map((id) =>
        id.toString(),
      );
      expect(leaderIds).toEqual([otherHex]);
    });

    it('rechaza nombrar jefe a alguien que no es adulto activo del grupo', async () => {
      const unit = makeUnit();
      unitModel.findById.mockReturnValue(chain(unit));
      userModel.countDocuments.mockResolvedValue(0);

      await expect(
        service.update(actor, unit._id.toString(), {
          unitLeaderId: new Types.ObjectId(),
        }),
      ).rejects.toMatchObject({ code: K.UNITS.LEADER_NOT_ELIGIBLE });
      expect(unitModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('un PATCH que no toca jefatura no consulta la elegibilidad', async () => {
      const unit = makeUnit();
      unitModel.findById.mockReturnValue(chain(unit));
      unitModel.findByIdAndUpdate.mockReturnValue(chain(unit));

      await service.update(actor, unit._id.toString(), { city: 'Cali' });

      expect(userModel.countDocuments).not.toHaveBeenCalled();
    });
  });

  describe('seedGroup', () => {
    const chief = {
      _id: new Types.ObjectId(),
      name: 'Zulema Ruiz',
      tipo: 'adulto',
      cargoSiscout: 'JEFE DE MANADA',
    };
    const cub = {
      _id: new Types.ObjectId(),
      name: 'Ana Ruiz',
      tipo: 'protagonista',
      cargoSiscout: 'LOBATO',
    };

    function peopleAre(people: Record<string, unknown>[]) {
      userModel.exists.mockReturnValue(chain({ _id: 'pending' }));
      userModel.find.mockReturnValue(chain(people));
    }

    it('no siembra si no queda ningun protagonista sin unidad', async () => {
      userModel.exists.mockReturnValue(chain(null));

      const outcome = await service.seedGroup(304);

      expect(outcome).toEqual({
        status: 'skipped',
        reason: 'all-assigned',
        discarded: [],
      });
      expect(userModel.exists).toHaveBeenCalledWith({
        groupId: 304,
        estado: true,
        tipo: 'protagonista',
        unitId: null,
      });
      expect(userModel.find).not.toHaveBeenCalled();
      expect(unitModel.create).not.toHaveBeenCalled();
    });

    it('crea la unidad, proyecta las membresias y escribe unitId en los protagonistas', async () => {
      peopleAre([chief, cub]);

      let created: Record<string, unknown> | undefined;
      unitModel.create.mockImplementation((docs: Record<string, unknown>[]) => {
        created = { ...docs[0], _id: new Types.ObjectId() };
        return Promise.resolve([created]);
      });

      const outcome = await service.seedGroup(304);

      expect(outcome).toMatchObject({ status: 'seeded', joined: 0 });
      expect(unitModel.create).toHaveBeenCalledTimes(1);
      expect((created?.members as Types.ObjectId[]).map(String)).toEqual([
        cub._id.toString(),
      ]);

      expect(membershipModel.insertMany).toHaveBeenCalledWith(
        [
          {
            userId: chief._id,
            unitId: created?._id,
            role: 'unit_leader',
            groupId: 304,
          },
          {
            userId: cub._id,
            unitId: created?._id,
            role: 'member',
            groupId: 304,
          },
        ],
        expect.anything(),
      );

      expect(userModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [cub._id] } },
        { $set: { unitId: created?._id } },
        expect.anything(),
      );
    });

    it('incorpora a los protagonistas nuevos a la unidad que ya existe de su rama', async () => {
      peopleAre([chief, cub]);
      const veteran = new Types.ObjectId();
      const host = makeUnit({ branch: 'manada', members: [veteran] });
      unitModel.find.mockReturnValue(chain([host]));

      const outcome = await service.seedGroup(304);

      expect(outcome).toMatchObject({
        status: 'seeded',
        created: [],
        joined: 1,
      });
      expect(unitModel.create).not.toHaveBeenCalled();
      expect((host.members as Types.ObjectId[]).map(String)).toEqual([
        veteran.toString(),
        cub._id.toString(),
      ]);
      expect(userModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: host.members } },
        { $set: { unitId: host._id } },
        expect.anything(),
      );
    });

    it('elige la unidad no vacia mas antigua cuando la rama tiene varias', async () => {
      peopleAre([chief, cub]);
      const emptiest = makeUnit({ branch: 'manada', members: [] });
      const populated = makeUnit({
        branch: 'manada',
        members: [new Types.ObjectId()],
      });
      unitModel.find.mockReturnValue(chain([emptiest, populated]));

      await service.seedGroup(304);

      expect(populated.save).toHaveBeenCalledTimes(1);
      expect(emptiest.save).not.toHaveBeenCalled();
    });

    it('no duplica a quien ya estuviera en la unidad de destino', async () => {
      peopleAre([chief, cub]);
      const host = makeUnit({ branch: 'manada', members: [cub._id] });
      unitModel.find.mockReturnValue(chain([host]));

      const outcome = await service.seedGroup(304);

      expect(outcome).toMatchObject({ status: 'seeded', joined: 0 });
      expect(host.save).not.toHaveBeenCalled();
      expect(host.members).toHaveLength(1);
    });

    it('reporta a los protagonistas sin rama legible en vez de tragarselos', async () => {
      const stray = {
        _id: new Types.ObjectId(),
        name: 'Iván Soto',
        tipo: 'protagonista',
        cargoSiscout: 'CARGO QUE NADIE CATALOGO',
      };
      peopleAre([chief, cub, stray]);
      unitModel.create.mockImplementation((docs: Record<string, unknown>[]) =>
        Promise.resolve([{ ...docs[0], _id: new Types.ObjectId() }]),
      );

      const outcome = await service.seedGroup(304);

      expect(outcome.discarded).toEqual([
        {
          _id: stray._id.toString(),
          name: 'Iván Soto',
          cargoSiscout: 'CARGO QUE NADIE CATALOGO',
        },
      ]);
    });

    it('reporta descartados aunque no quede ninguna unidad que sembrar', async () => {
      const stray = {
        _id: new Types.ObjectId(),
        name: 'Iván Soto',
        tipo: 'protagonista',
        cargoSiscout: '',
      };
      peopleAre([chief, stray]);

      const outcome = await service.seedGroup(304);

      expect(outcome).toMatchObject({
        status: 'skipped',
        reason: 'no-protagonists',
      });
      expect(outcome.discarded).toHaveLength(1);
      expect(unitModel.create).not.toHaveBeenCalled();
    });

    it('trata la clave duplicada como una siembra concurrente, no como un 500', async () => {
      peopleAre([chief, cub]);
      unitModel.create.mockRejectedValue(
        Object.assign(new Error('E11000 duplicate key'), { code: 11000 }),
      );

      const outcome = await service.seedGroup(304);

      expect(outcome).toMatchObject({
        status: 'skipped',
        reason: 'already-seeded',
      });
    });

    it('deja subir cualquier otro fallo de la siembra', async () => {
      peopleAre([chief, cub]);
      unitModel.create.mockRejectedValue(new Error('se cayó la red'));

      await expect(service.seedGroup(304)).rejects.toThrow('se cayó la red');
    });
  });

  describe('declareLeadership', () => {
    it('deja declarar a quien no tiene rama ni por SiScout ni asignada', async () => {
      currentUser.get.mockResolvedValue(collaborator(304));
      const troop = makeUnit({ groupId: 304, branch: 'tropa' });
      const pack = makeUnit({ groupId: 304, branch: 'manada' });
      unitModel.find.mockReturnValue(chain([troop, pack]));

      const result = await service.declareLeadership(actor, 'JEFE DE TROPA');

      expect(result).toEqual([troop]);
      expect(userModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: actorId.toString() }),
        {
          $push: { cargos: { nombreCargo: 'JEFE DE TROPA', nivel: 'rama' } },
        },
      );
      expect(currentUser.refresh).toHaveBeenCalledWith('99');
    });

    it('el ataque: la jefa de manada no se auto-concede la tropa', async () => {
      currentUser.get.mockResolvedValue(packLeader(304));
      unitModel.find.mockReturnValue(
        chain([makeUnit({ groupId: 304, branch: 'tropa', name: 'Tropa 304' })]),
      );

      await expect(
        service.declareLeadership(actor, 'JEFE DE TROPA'),
      ).rejects.toMatchObject({ code: K.UNITS.LEADERSHIP_ALREADY_SCOPED });

      expect(userModel.updateOne).not.toHaveBeenCalled();
      expect(currentUser.refresh).not.toHaveBeenCalled();
    });

    it('responde 403 al ataque, no 400: es una escalada, no un dato mal escrito', async () => {
      currentUser.get.mockResolvedValue(packLeader(304));

      await expect(
        service.declareLeadership(actor, 'JEFE DE TROPA'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('quien ya declaró una jefatura no puede declarar otra', async () => {
      currentUser.get.mockResolvedValue({
        ...collaborator(304),
        cargos: [{ nombreCargo: 'JEFE DE TROPA', nivel: 'rama' as const }],
      });

      await expect(
        service.declareLeadership(actor, 'JEFE DE CLAN'),
      ).rejects.toMatchObject({ code: K.UNITS.LEADERSHIP_ALREADY_SCOPED });
      expect(userModel.updateOne).not.toHaveBeenCalled();
    });

    it('el jefe de grupo tampoco declara: ya alcanza todas las ramas', async () => {
      currentUser.get.mockResolvedValue(groupLeader(304));

      await expect(
        service.declareLeadership(actor, 'JEFE DE TROPA'),
      ).rejects.toMatchObject({ code: K.UNITS.LEADERSHIP_ALREADY_SCOPED });
      expect(userModel.updateOne).not.toHaveBeenCalled();
    });

    it('sin grupo el problema es otro: MISSING_GROUP', async () => {
      currentUser.get.mockResolvedValue({
        _id: actorId.toString(),
        cargoSiscout: 'COLABORADOR DE GRUPO',
      });

      await expect(
        service.declareLeadership(actor, 'JEFE DE TROPA'),
      ).rejects.toMatchObject({ code: K.UNITS.MISSING_GROUP });
      expect(userModel.updateOne).not.toHaveBeenCalled();
    });

    it('rechaza un cargo que no es jefatura de rama antes de mirar el perfil', async () => {
      currentUser.get.mockResolvedValue(collaborator(304));

      await expect(
        service.declareLeadership(actor, 'JEFE DE GRUPO'),
      ).rejects.toMatchObject({ code: K.UNITS.LEADERSHIP_NOT_A_BRANCH });
      expect(userModel.updateOne).not.toHaveBeenCalled();
    });

    it('si la escritura no prende, nadie recibe unidades de una rama que no obtuvo', async () => {
      currentUser.get.mockResolvedValue(collaborator(304));
      userModel.updateOne.mockReturnValue(chain({ modifiedCount: 0 }));

      await expect(
        service.declareLeadership(actor, 'JEFE DE TROPA'),
      ).rejects.toMatchObject({ code: K.UNITS.LEADERSHIP_ALREADY_SCOPED });
    });

    it('la escritura solo prende si no hay ya un cargo de rama, no solo si no se repite el nombre', async () => {
      currentUser.get.mockResolvedValue(collaborator(304));

      await service.declareLeadership(actor, 'JEFE DE TROPA');

      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: actorId.toString(), 'cargos.nivel': { $ne: 'rama' } },
        expect.anything(),
      );
    });
  });

  describe('setMembersSchema', () => {
    it('rechaza ids repetidos: inflan members.length y descuadran la unidad', () => {
      const id = '507f191e810c19729de860ea';
      const parsed = setMembersSchema.safeParse({ memberIds: [id, id] });

      expect(parsed.success).toBe(false);
    });

    it('acepta una lista sin repetidos', () => {
      const parsed = setMembersSchema.safeParse({
        memberIds: ['507f191e810c19729de860ea', '507f191e810c19729de860eb'],
      });

      expect(parsed.success).toBe(true);
    });
  });

  describe('updateUnitSchema', () => {
    it('ignora members, branch y groupId: solo setMembers y la siembra los tocan', () => {
      const parsed = updateUnitSchema.parse({
        name: 'Nuevo nombre',
        members: ['507f191e810c19729de860ea'],
        branch: 'tropa',
        groupId: 999,
      });

      expect(parsed).toEqual({ name: 'Nuevo nombre' });
    });
  });
});
