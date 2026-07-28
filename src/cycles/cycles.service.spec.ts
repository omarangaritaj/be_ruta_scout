import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { AppForbiddenException, AppNotFoundException } from '../common';
import { CurrentUserService } from '../current-user/current-user.service';
import { QuestionsService } from '../questions/questions.service';
import { Unit } from '../units/schemas/unit.schema';
import { Cycle } from './schemas/cycle.schema';
import { CyclesService } from './cycles.service';

const actor: AuthUser = { userId: 'actor', idSiscout: '99' };
const NATION_PROFILE = { nivelAcceso: 'nacion' };
const BRANCH_PROFILE = {
  nivelAcceso: 'rama',
  groupId: 7,
  cargoSiscout: 'JEFE DE MANADA',
};

function chainOf(value: unknown) {
  return {
    sort: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(value) }),
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('CyclesService', () => {
  let service: CyclesService;
  let cycleModel: { find: jest.Mock; findById: jest.Mock; create: jest.Mock };
  let unitModel: { find: jest.Mock; findById: jest.Mock };
  let currentUser: { get: jest.Mock };

  beforeEach(async () => {
    cycleModel = { find: jest.fn(), findById: jest.fn(), create: jest.fn() };
    unitModel = { find: jest.fn(), findById: jest.fn() };
    currentUser = { get: jest.fn().mockResolvedValue(NATION_PROFILE) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CyclesService,
        { provide: getModelToken(Cycle.name), useValue: cycleModel },
        { provide: getModelToken(Unit.name), useValue: unitModel },
        {
          provide: QuestionsService,
          useValue: { findActiveByBranch: jest.fn() },
        },
        { provide: CurrentUserService, useValue: currentUser },
      ],
    }).compile();

    service = moduleRef.get(CyclesService);
  });

  it('ordena el listado por fecha de inicio descendente', async () => {
    unitModel.find.mockReturnValue(
      chainOf([{ _id: 'u1', groupId: 7, branch: 'manada' }]),
    );
    cycleModel.find.mockReturnValue(chainOf([]));

    await service.findAll(actor);

    expect(cycleModel.find).toHaveBeenCalled();
    const chain = cycleModel.find.mock.results[0].value as { sort: jest.Mock };
    expect(chain.sort).toHaveBeenCalledWith({ startDate: -1, _id: 1 });
  });

  it('excluye los ciclos desactivados', async () => {
    unitModel.find.mockReturnValue(
      chainOf([{ _id: 'u1', groupId: 7, branch: 'manada' }]),
    );
    cycleModel.find.mockReturnValue(chainOf([]));

    await service.findAll(actor);

    expect(cycleModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });

  it('falla con 404 cuando el ciclo no existe', async () => {
    cycleModel.findById.mockReturnValue(chainOf(null));

    await expect(service.findOne(actor, 'c1')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });

  it('falla con 404 cuando el ciclo está desactivado (softdelete)', async () => {
    cycleModel.findById.mockReturnValue(
      chainOf({ _id: 'c1', unitId: 'u1', isActive: false }),
    );

    await expect(service.findOne(actor, 'c1')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
    expect(unitModel.findById).not.toHaveBeenCalled();
  });

  it('falla con 403 cuando el ciclo está fuera del alcance', async () => {
    cycleModel.findById.mockReturnValue(
      chainOf({ _id: 'c1', unitId: 'u2', isActive: true }),
    );
    unitModel.findById.mockReturnValue(
      chainOf({ _id: 'u2', groupId: 99, branch: 'tropa' }),
    );
    currentUser.get.mockResolvedValue(BRANCH_PROFILE);

    await expect(service.findOne(actor, 'c1')).rejects.toBeInstanceOf(
      AppForbiddenException,
    );
  });

  it('devuelve el ciclo cuando la unidad sí está dentro del alcance de rama', async () => {
    const cycle = { _id: 'c1', unitId: 'u1', isActive: true };
    cycleModel.findById.mockReturnValue(chainOf(cycle));
    unitModel.findById.mockReturnValue(
      chainOf({ _id: 'u1', groupId: 7, branch: 'manada' }),
    );
    currentUser.get.mockResolvedValue(BRANCH_PROFILE);

    await expect(service.findOne(actor, 'c1')).resolves.toBe(cycle);
  });
});
