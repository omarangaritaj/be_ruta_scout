import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import {
  AppBadRequestException,
  AppConflictException,
  AppForbiddenException,
  AppNotFoundException,
} from '../common';
import { CurrentUserService } from '../current-user/current-user.service';
import { D } from '../domain';
import { GrowthItemsService } from '../growth-items/growth-items.service';
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
  let questionsMock: { findActiveByBranch: jest.Mock };
  let growthItemsMock: { findAll: jest.Mock };

  beforeEach(async () => {
    cycleModel = { find: jest.fn(), findById: jest.fn(), create: jest.fn() };
    unitModel = { find: jest.fn(), findById: jest.fn() };
    currentUser = { get: jest.fn().mockResolvedValue(NATION_PROFILE) };
    questionsMock = { findActiveByBranch: jest.fn() };
    growthItemsMock = { findAll: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CyclesService,
        { provide: getModelToken(Cycle.name), useValue: cycleModel },
        { provide: getModelToken(Unit.name), useValue: unitModel },
        { provide: QuestionsService, useValue: questionsMock },
        { provide: GrowthItemsService, useValue: growthItemsMock },
        { provide: CurrentUserService, useValue: currentUser },
      ],
    }).compile();

    service = moduleRef.get(CyclesService);
  });

  it('ordena el listado por fecha de inicio descendente', async () => {
    unitModel.find.mockReturnValue(
      chainOf([{ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }]),
    );
    cycleModel.find.mockReturnValue(chainOf([]));

    await service.findAll(actor);

    expect(cycleModel.find).toHaveBeenCalled();
    const chain = cycleModel.find.mock.results[0].value as { sort: jest.Mock };
    expect(chain.sort).toHaveBeenCalledWith({ startDate: -1, _id: 1 });
  });

  it('excluye los ciclos desactivados', async () => {
    unitModel.find.mockReturnValue(
      chainOf([{ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }]),
    );
    cycleModel.find.mockReturnValue(chainOf([]));

    await service.findAll(actor);

    expect(cycleModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });

  it('el listado solo pide los ciclos de las unidades que alcanza el perfil', async () => {
    currentUser.get.mockResolvedValue(BRANCH_PROFILE);
    unitModel.find.mockReturnValue(
      chainOf([
        { _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA },
        { _id: 'u2', groupId: 7, branch: D.BRANCH.TROPA },
        { _id: 'u3', groupId: 99, branch: D.BRANCH.MANADA },
      ]),
    );
    cycleModel.find.mockReturnValue(chainOf([]));

    await service.findAll(actor);

    expect(cycleModel.find).toHaveBeenCalledWith({
      isActive: true,
      unitId: { $in: ['u1'] },
    });
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
      chainOf({ _id: 'u2', groupId: 99, branch: D.BRANCH.TROPA }),
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
      chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
    );
    currentUser.get.mockResolvedValue(BRANCH_PROFILE);

    await expect(service.findOne(actor, 'c1')).resolves.toBe(cycle);
  });

  describe('saveDiagnostic', () => {
    it('rechaza una respuesta de una pregunta de otra rama', async () => {
      cycleModel.findById.mockReturnValue(
        chainOf({
          _id: 'c1',
          unitId: 'u1',
          isActive: true,
          diagnosticAnswers: [],
        }),
      );
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );
      questionsMock.findActiveByBranch.mockResolvedValue([
        {
          _id: 'q1',
          branch: D.BRANCH.TROPA,
          block: D.DIAGNOSTIC_BLOCK.RAP,
          text: 'Uno',
        },
      ]);

      await expect(
        service.saveDiagnostic(actor, 'c1', {
          answers: [{ questionId: 'q1', score: 3 }],
          summary: 'Intento',
        } as never),
      ).rejects.toBeInstanceOf(AppBadRequestException);
    });

    it('guarda el texto y el bloque desde el catálogo, no desde el cliente', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const cycle = {
        _id: 'c1',
        unitId: 'u1',
        isActive: true,
        diagnosticAnswers: [],
        save,
      };
      cycleModel.findById.mockReturnValue(chainOf(cycle));
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );
      questionsMock.findActiveByBranch.mockResolvedValue([
        {
          _id: 'q1',
          branch: D.BRANCH.MANADA,
          block: D.DIAGNOSTIC_BLOCK.GSAT,
          text: 'Real',
        },
      ]);

      await service.saveDiagnostic(actor, 'c1', {
        answers: [{ questionId: 'q1', score: 4 }],
        summary: 'La unidad viene floja en participación',
      } as never);

      expect(cycle.diagnosticAnswers).toEqual([
        {
          questionId: 'q1',
          questionText: 'Real',
          block: D.DIAGNOSTIC_BLOCK.GSAT,
          score: 4,
        },
      ]);
      expect(save).toHaveBeenCalled();
    });

    it('rechaza dos respuestas para la misma pregunta', async () => {
      cycleModel.findById.mockReturnValue(
        chainOf({
          _id: 'c1',
          unitId: 'u1',
          isActive: true,
          diagnosticAnswers: [],
        }),
      );
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );
      questionsMock.findActiveByBranch.mockResolvedValue([
        {
          _id: 'q1',
          branch: D.BRANCH.MANADA,
          block: D.DIAGNOSTIC_BLOCK.RAP,
          text: 'Uno',
        },
      ]);

      await expect(
        service.saveDiagnostic(actor, 'c1', {
          answers: [
            { questionId: 'q1', score: 3 },
            { questionId: 'q1', score: 5 },
          ],
          summary: 'Doble',
        } as never),
      ).rejects.toBeInstanceOf(AppBadRequestException);
    });

    it('rechaza con 409 un diagnóstico que ya fue registrado', async () => {
      cycleModel.findById.mockReturnValue(
        chainOf({
          _id: 'c1',
          unitId: 'u1',
          isActive: true,
          diagnosticAnswers: [{ questionId: 'q1' }],
          diagnosticSummary: 'Ya quedó escrito',
        }),
      );
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );

      await expect(
        service.saveDiagnostic(actor, 'c1', {
          answers: [{ questionId: 'q1', score: 3 }],
          summary: 'Intento de reescritura',
        } as never),
      ).rejects.toBeInstanceOf(AppConflictException);
    });

    it('no consulta el catálogo si el diagnóstico ya está cerrado', async () => {
      cycleModel.findById.mockReturnValue(
        chainOf({
          _id: 'c1',
          unitId: 'u1',
          isActive: true,
          diagnosticAnswers: [{ questionId: 'q1' }],
          diagnosticSummary: 'Ya quedó escrito',
        }),
      );
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );

      await expect(
        service.saveDiagnostic(actor, 'c1', {
          answers: [],
          summary: 'x',
        }),
      ).rejects.toBeInstanceOf(AppConflictException);
      expect(questionsMock.findActiveByBranch).not.toHaveBeenCalled();
    });

    it('rechaza un diagnóstico al que le faltan preguntas', async () => {
      cycleModel.findById.mockReturnValue(
        chainOf({
          _id: 'c1',
          unitId: 'u1',
          isActive: true,
          diagnosticAnswers: [],
        }),
      );
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );
      questionsMock.findActiveByBranch.mockResolvedValue([
        {
          _id: 'q1',
          branch: D.BRANCH.MANADA,
          block: D.DIAGNOSTIC_BLOCK.RAP,
          text: 'Uno',
        },
        {
          _id: 'q2',
          branch: D.BRANCH.MANADA,
          block: D.DIAGNOSTIC_BLOCK.GSAT,
          text: 'Dos',
        },
      ]);

      await expect(
        service.saveDiagnostic(actor, 'c1', {
          answers: [{ questionId: 'q1', score: 3 }],
          summary: 'Media tabla',
        } as never),
      ).rejects.toBeInstanceOf(AppBadRequestException);
    });

    it('guarda la síntesis junto con las respuestas', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const cycle = {
        _id: 'c1',
        unitId: 'u1',
        isActive: true,
        diagnosticAnswers: [],
        save,
      };
      cycleModel.findById.mockReturnValue(chainOf(cycle));
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );
      questionsMock.findActiveByBranch.mockResolvedValue([
        {
          _id: 'q1',
          branch: D.BRANCH.MANADA,
          block: D.DIAGNOSTIC_BLOCK.GSAT,
          text: 'Real',
        },
      ]);

      await service.saveDiagnostic(actor, 'c1', {
        answers: [{ questionId: 'q1', score: 4 }],
        summary: 'La unidad viene floja en participación',
      } as never);

      expect(cycle).toHaveProperty(
        'diagnosticSummary',
        'La unidad viene floja en participación',
      );
    });
  });

  describe('updateFocus', () => {
    it('mezcla el enfoque nuevo sobre el guardado y marca la ruta como modificada', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const markModified = jest.fn();
      const cycle = {
        _id: 'c1',
        unitId: 'u1',
        isActive: true,
        focus: { objective: 'Viejo', competencies: [] },
        markModified,
        save,
      };
      cycleModel.findById.mockReturnValue(chainOf(cycle));
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );

      await service.updateFocus(actor, 'c1', {
        objective: 'Nuevo',
        educationalFocus: 'Convivencia',
      });

      expect(cycle.focus).toEqual({
        objective: 'Nuevo',
        educationalFocus: 'Convivencia',
        competencies: [],
      });
      expect(markModified).toHaveBeenCalledWith('focus');
      expect(save).toHaveBeenCalled();
    });

    it('borra un campo del enfoque cuando llega vacío', async () => {
      const cycle = {
        _id: 'c1',
        unitId: 'u1',
        isActive: true,
        focus: { objective: 'Viejo', competencies: [] },
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      cycleModel.findById.mockReturnValue(chainOf(cycle));
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );

      await service.updateFocus(actor, 'c1', { objective: '' });

      expect(cycle.focus).toEqual({ objective: '', competencies: [] });
    });

    it('guarda el texto y el área desde el catálogo, no desde el cliente', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const cycle = {
        _id: 'c1',
        unitId: 'u1',
        isActive: true,
        focus: { competencies: [] },
        markModified: jest.fn(),
        save,
      };
      cycleModel.findById.mockReturnValue(chainOf(cycle));
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );
      growthItemsMock.findAll.mockResolvedValue([
        {
          _id: 'g1',
          branch: D.BRANCH.MANADA,
          growthArea: D.GROWTH_AREA.CARACTER,
          text: 'Toma decisiones propias',
        },
      ]);

      await service.updateFocus(actor, 'c1', {
        competencies: ['g1'],
      } as never);

      expect(cycle.focus).toEqual({
        competencies: [
          {
            growthItemId: 'g1',
            text: 'Toma decisiones propias',
            growthArea: D.GROWTH_AREA.CARACTER,
          },
        ],
      });
      expect(save).toHaveBeenCalled();
    });

    it('rechaza una competencia que no está en el catálogo de la rama', async () => {
      cycleModel.findById.mockReturnValue(
        chainOf({
          _id: 'c1',
          unitId: 'u1',
          isActive: true,
          focus: { competencies: [] },
          markModified: jest.fn(),
          save: jest.fn(),
        }),
      );
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );
      growthItemsMock.findAll.mockResolvedValue([]);

      await expect(
        service.updateFocus(actor, 'c1', { competencies: ['g9'] } as never),
      ).rejects.toBeInstanceOf(AppBadRequestException);
    });

    it('rechaza la misma competencia repetida', async () => {
      cycleModel.findById.mockReturnValue(
        chainOf({
          _id: 'c1',
          unitId: 'u1',
          isActive: true,
          focus: { competencies: [] },
          markModified: jest.fn(),
          save: jest.fn(),
        }),
      );
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );
      growthItemsMock.findAll.mockResolvedValue([
        {
          _id: 'g1',
          branch: D.BRANCH.MANADA,
          growthArea: D.GROWTH_AREA.CARACTER,
          text: 'Toma decisiones propias',
        },
      ]);

      await expect(
        service.updateFocus(actor, 'c1', {
          competencies: ['g1', 'g1'],
        } as never),
      ).rejects.toBeInstanceOf(AppBadRequestException);
    });

    it('acepta más de tres competencias', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const cycle = {
        _id: 'c1',
        unitId: 'u1',
        isActive: true,
        focus: { competencies: [] },
        markModified: jest.fn(),
        save,
      };
      cycleModel.findById.mockReturnValue(chainOf(cycle));
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );
      growthItemsMock.findAll.mockResolvedValue(
        ['g1', 'g2', 'g3', 'g4'].map((id) => ({
          _id: id,
          branch: D.BRANCH.MANADA,
          growthArea: D.GROWTH_AREA.CARACTER,
          text: `Competencia ${id}`,
        })),
      );

      await service.updateFocus(actor, 'c1', {
        competencies: ['g1', 'g2', 'g3', 'g4'],
      } as never);

      expect(cycle.focus.competencies).toHaveLength(4);
    });

    it('no consulta el catálogo cuando el enfoque no trae competencias', async () => {
      cycleModel.findById.mockReturnValue(
        chainOf({
          _id: 'c1',
          unitId: 'u1',
          isActive: true,
          focus: { competencies: [] },
          markModified: jest.fn(),
          save: jest.fn().mockResolvedValue(undefined),
        }),
      );
      unitModel.findById.mockReturnValue(
        chainOf({ _id: 'u1', groupId: 7, branch: D.BRANCH.MANADA }),
      );

      await service.updateFocus(actor, 'c1', { objective: 'Nuevo' });

      expect(growthItemsMock.findAll).not.toHaveBeenCalled();
    });
  });
});
