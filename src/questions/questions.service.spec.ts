import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { AppNotFoundException } from '../common';
import { Question } from './schemas/question.schema';
import { QuestionsService } from './questions.service';

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

describe('QuestionsService', () => {
  let service: QuestionsService;
  let model: ReturnType<typeof modelMock>;

  beforeEach(async () => {
    model = modelMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        QuestionsService,
        { provide: getModelToken(Question.name), useValue: model },
      ],
    }).compile();
    service = moduleRef.get(QuestionsService);
  });

  it('lista solo las activas por defecto', async () => {
    model.chain.sort.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

    await service.findAll();

    expect(model.find).toHaveBeenCalledWith({ isActive: true });
  });

  it('incluye las inactivas cuando se pide', async () => {
    model.chain.sort.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

    await service.findAll(undefined, true);

    expect(model.find).toHaveBeenCalledWith({});
  });

  it('filtra por rama', async () => {
    model.chain.sort.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

    await service.findAll('manada');

    expect(model.find).toHaveBeenCalledWith({
      isActive: true,
      branch: 'manada',
    });
  });

  it('ordena por order y desempata por _id', async () => {
    model.chain.sort.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

    await service.findAll();

    expect(model.chain.sort).toHaveBeenCalledWith({ order: 1, _id: 1 });
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

  it('falla al desactivar una pregunta inexistente', async () => {
    model.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.remove('abc')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });
});
