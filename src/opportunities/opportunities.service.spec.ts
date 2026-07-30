import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import {
  AppBadRequestException,
  AppForbiddenException,
  AppNotFoundException,
} from '../common';
import { CyclesService } from '../cycles/cycles.service';
import { D } from '../domain';
import { K } from '../i18n';
import { LearningOpportunity } from './schemas/learning-opportunity.schema';
import { OpportunitiesService } from './opportunities.service';

const actor: AuthUser = { userId: 'actor', idSiscout: '99' };

function chainOf(value: unknown) {
  return {
    sort: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(value) }),
    exec: jest.fn().mockResolvedValue(value),
  };
}

const baseDto = {
  name: 'Fogata scout',
  description: 'Compartir historias alrededor del fuego',
  protagonistVoice: 'Quiero contar mi propia historia',
  audience: D.OPPORTUNITY_AUDIENCE.UNIT,
};

describe('OpportunitiesService', () => {
  let service: OpportunitiesService;
  let opportunityModel: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let cyclesService: { findOne: jest.Mock };

  beforeEach(async () => {
    opportunityModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };
    cyclesService = { findOne: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OpportunitiesService,
        {
          provide: getModelToken(LearningOpportunity.name),
          useValue: opportunityModel,
        },
        { provide: CyclesService, useValue: cyclesService },
      ],
    }).compile();

    service = moduleRef.get(OpportunitiesService);
  });

  it('rechaza una competencia que no está en el enfoque del ciclo', async () => {
    cyclesService.findOne.mockResolvedValue({
      _id: 'c1',
      focus: { competencies: [] },
    });

    await expect(
      service.create(actor, 'c1', {
        ...baseDto,
        competencyId: 'g9',
      } as never),
    ).rejects.toBeInstanceOf(AppBadRequestException);
    expect(opportunityModel.create).not.toHaveBeenCalled();
  });

  it('guarda el texto y el área desde el enfoque, no desde el cliente', async () => {
    cyclesService.findOne.mockResolvedValue({
      _id: 'c1',
      focus: {
        competencies: [
          {
            growthItemId: 'g1',
            text: 'Texto del enfoque',
            growthArea: D.GROWTH_AREA.CARACTER,
          },
        ],
      },
    });
    opportunityModel.create.mockResolvedValue({ _id: 'o1' });

    await service.create(actor, 'c1', {
      ...baseDto,
      competencyId: 'g1',
    } as never);

    expect(opportunityModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleId: 'c1',
        competency: {
          growthItemId: 'g1',
          text: 'Texto del enfoque',
          growthArea: D.GROWTH_AREA.CARACTER,
        },
      }),
    );
  });

  it('acepta al editar la competencia que la oportunidad ya tenía, aunque haya salido del enfoque', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const opportunity = {
      _id: 'o1',
      cycleId: 'c1',
      competency: {
        growthItemId: 'g1',
        text: 'Guardado',
        growthArea: D.GROWTH_AREA.CARACTER,
      },
      save,
    };
    cyclesService.findOne.mockResolvedValue({
      _id: 'c1',
      focus: { competencies: [] },
    });
    opportunityModel.findOne.mockReturnValue(chainOf(opportunity));

    await service.update(actor, 'c1', 'o1', { competencyId: 'g1' } as never);

    expect(opportunity.competency).toEqual({
      growthItemId: 'g1',
      text: 'Guardado',
      growthArea: D.GROWTH_AREA.CARACTER,
    });
    expect(save).toHaveBeenCalled();
  });

  it('rechaza al editar una competencia nueva que no está en el enfoque', async () => {
    const opportunity = {
      _id: 'o1',
      cycleId: 'c1',
      competency: {
        growthItemId: 'g1',
        text: 'Guardado',
        growthArea: D.GROWTH_AREA.CARACTER,
      },
      save: jest.fn(),
    };
    cyclesService.findOne.mockResolvedValue({
      _id: 'c1',
      focus: { competencies: [] },
    });
    opportunityModel.findOne.mockReturnValue(chainOf(opportunity));

    await expect(
      service.update(actor, 'c1', 'o1', { competencyId: 'g2' } as never),
    ).rejects.toBeInstanceOf(AppBadRequestException);
    expect(opportunity.save).not.toHaveBeenCalled();
  });

  it('excluye las oportunidades desactivadas del listado', async () => {
    cyclesService.findOne.mockResolvedValue({
      _id: 'c1',
      focus: { competencies: [] },
    });
    opportunityModel.find.mockReturnValue(chainOf([]));

    await service.findAll(actor, 'c1');

    expect(opportunityModel.find).toHaveBeenCalledWith({
      cycleId: 'c1',
      isActive: true,
    });
  });

  it('propaga el 403 cuando el ciclo está fuera de alcance', async () => {
    cyclesService.findOne.mockRejectedValue(
      new AppForbiddenException(K.CYCLES.OUT_OF_SCOPE),
    );

    await expect(service.findAll(actor, 'c1')).rejects.toBeInstanceOf(
      AppForbiddenException,
    );
    expect(opportunityModel.find).not.toHaveBeenCalled();
  });

  it('rechaza el update de una oportunidad que no aparece con ese id y cycleId', async () => {
    cyclesService.findOne.mockResolvedValue({
      _id: 'c1',
      focus: { competencies: [] },
    });
    opportunityModel.findOne.mockReturnValue(chainOf(null));

    await expect(
      service.update(actor, 'c1', 'o9', { name: 'Nuevo nombre' }),
    ).rejects.toBeInstanceOf(AppNotFoundException);
  });
});
