import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import {
  AppBadRequestException,
  AppConflictException,
  AppNotFoundException,
} from '../common';
import { GrowthItem } from './schemas/growth-item.schema';
import { GrowthItemsService } from './growth-items.service';

function modelMock() {
  const chain = { sort: jest.fn().mockReturnValue({ exec: jest.fn() }) };
  return {
    find: jest.fn().mockReturnValue(chain),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    create: jest.fn(),
    chain,
  };
}

function duplicateKeyError() {
  return Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
}

describe('GrowthItemsService', () => {
  let service: GrowthItemsService;
  let model: ReturnType<typeof modelMock>;

  beforeEach(async () => {
    model = modelMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        GrowthItemsService,
        { provide: getModelToken(GrowthItem.name), useValue: model },
      ],
    }).compile();
    service = moduleRef.get(GrowthItemsService);
    model.chain.sort.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
  });

  it('lista solo las activas por defecto', async () => {
    await service.findAll();

    expect(model.find).toHaveBeenCalledWith({ isActive: true });
  });

  it('filtra por rama y área', async () => {
    await service.findAll('tropa', 'afectividad');

    expect(model.find).toHaveBeenCalledWith({
      isActive: true,
      branch: 'tropa',
      growthArea: 'afectividad',
    });
  });

  it('ordena por rama, área y orden', async () => {
    await service.findAll();

    expect(model.chain.sort).toHaveBeenCalledWith({
      branch: 1,
      growthArea: 1,
      order: 1,
    });
  });

  it('crea cuando el área corresponde a la rama', async () => {
    model.create.mockResolvedValue({ id: 'abc' });

    await service.create({
      branch: 'tropa',
      growthArea: 'afectividad',
      text: 'Competencia',
      order: 1,
    });

    expect(model.create).toHaveBeenCalled();
  });

  it('rechaza crear con un área ajena a la rama', async () => {
    await expect(
      service.create({
        branch: 'familia',
        growthArea: 'afectividad',
        text: 'Dimensión',
        order: 1,
      }),
    ).rejects.toBeInstanceOf(AppBadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('traduce el orden duplicado a conflicto', async () => {
    model.create.mockRejectedValue(duplicateKeyError());

    await expect(
      service.create({
        branch: 'tropa',
        growthArea: 'afectividad',
        text: 'Competencia',
        order: 1,
      }),
    ).rejects.toBeInstanceOf(AppConflictException);
  });

  it('valida el área del update contra la rama ya guardada', async () => {
    model.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ branch: 'familia' }),
    });

    await expect(
      service.update('abc', { growthArea: 'afectividad' }),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('desactiva en lugar de borrar', async () => {
    model.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ id: 'abc' }),
    });

    await service.remove('abc');

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith('abc', {
      isActive: false,
    });
  });

  it('falla al desactivar una dimensión inexistente', async () => {
    model.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.remove('abc')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });
});
