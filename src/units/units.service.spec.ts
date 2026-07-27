import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CurrentUserService } from '../current-user/current-user.service';
import { K } from '../i18n';
import { User } from '../users/schemas/user.schema';
import { updateUnitSchema } from './dto/update-unit.dto';
import { UnitMembership } from './schemas/unit-membership.schema';
import { Unit } from './schemas/unit.schema';
import { UnitsService } from './units.service';

type UnitDoc = Record<string, unknown> & {
  _id: Types.ObjectId;
  save: jest.Mock;
};

function chain(result: unknown) {
  const query: Record<string, jest.Mock> = {};
  query.session = jest.fn(() => query);
  query.exec = jest.fn(() => Promise.resolve(result));
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
  let membershipModel: { deleteMany: jest.Mock; insertMany: jest.Mock };
  let userModel: {
    updateMany: jest.Mock;
    updateOne: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    unitModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(() => chain(null)),
      create: jest.fn(),
      exists: jest.fn(() => ({
        session: jest.fn(() => Promise.resolve(false)),
      })),
      find: jest.fn(() => chain([])),
    };
    membershipModel = {
      deleteMany: jest.fn(() => Promise.resolve({})),
      insertMany: jest.fn(() => Promise.resolve([])),
    };
    userModel = {
      updateMany: jest.fn(() => Promise.resolve({})),
      updateOne: jest.fn(() => chain({})),
      find: jest.fn(),
    };
    const connection = {
      startSession: jest.fn(() => Promise.resolve(makeSession())),
    };
    const currentUser = { get: jest.fn(), refresh: jest.fn() };

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

      await service.configure(unit._id.toString(), dto);

      const leaderIds = (unit.leaders as Types.ObjectId[]).map((id) =>
        id.toString(),
      );
      expect(leaderIds).toEqual([otherHex]);
    });
  });

  describe('setMembers', () => {
    it('rechaza una lista vacia con MEMBERS_REQUIRED', async () => {
      const unit = makeUnit({ members: [new Types.ObjectId()] });
      unitModel.findById.mockReturnValue(chain(unit));

      await expect(
        service.setMembers(unit._id.toString(), []),
      ).rejects.toMatchObject({ code: K.UNITS.MEMBERS_REQUIRED });
    });

    it('rechaza un id ajeno a la unidad con MEMBERS_NOT_IN_UNIT', async () => {
      const unit = makeUnit({ members: [new Types.ObjectId()] });
      const outsider = new Types.ObjectId();
      unitModel.findById.mockReturnValue(chain(unit));

      await expect(
        service.setMembers(unit._id.toString(), [outsider.toString()]),
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

      const result = await service.setMembers(unit._id.toString(), [
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

    it('no crea ninguna unidad si nadie sale', async () => {
      const a = new Types.ObjectId();
      const b = new Types.ObjectId();
      const unit = makeUnit({ members: [a, b] });
      unitModel.findById.mockReturnValue(chain(unit));

      const result = await service.setMembers(unit._id.toString(), [
        a.toString(),
        b.toString(),
      ]);

      expect(unitModel.create).not.toHaveBeenCalled();
      expect(result).toEqual([unit]);
    });
  });

  describe('remove', () => {
    it('rechaza eliminar una unidad que todavia tiene protagonistas', async () => {
      const unit = makeUnit({ members: [new Types.ObjectId()] });
      unitModel.findById.mockReturnValue(chain(unit));

      await expect(service.remove(unit._id.toString())).rejects.toMatchObject({
        code: K.UNITS.CANNOT_DELETE_WITH_MEMBERS,
      });
      expect(unitModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('elimina una unidad sin protagonistas y limpia unit_memberships', async () => {
      const unit = makeUnit({ members: [] });
      unitModel.findById.mockReturnValue(chain(unit));
      unitModel.findByIdAndDelete.mockReturnValue(chain(unit));

      let deletedFilter: Record<string, unknown> | undefined;
      membershipModel.deleteMany.mockImplementation(
        (filter: Record<string, unknown>) => {
          deletedFilter = filter;
          return Promise.resolve({});
        },
      );

      await service.remove(unit._id.toString());

      expect(unitModel.findByIdAndDelete).toHaveBeenCalledTimes(1);
      expect(deletedFilter).toEqual({ unitId: unit._id });
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
