import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { AppNotFoundException } from '../common';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/schemas/user.schema';
import { CurrentUserService } from './current-user.service';

const ID_SISCOUT = '25123';
const CACHE_KEY = `current_user:${ID_SISCOUT}`;
const TTL = 43200;

const profile = {
  _id: '6a69234027965125d084ea97',
  name: 'SOTO MELO MARIA ALEJANDRA',
  groupId: 66,
};

describe('CurrentUserService', () => {
  let service: CurrentUserService;
  let redis: {
    get: jest.Mock;
    set: jest.Mock;
    has: jest.Mock;
    updateExisting: jest.Mock;
    del: jest.Mock;
  };
  let userModel: { aggregate: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    redis = {
      get: jest.fn(() => Promise.resolve(null)),
      set: jest.fn(() => Promise.resolve()),
      has: jest.fn(() => Promise.resolve(false)),
      updateExisting: jest.fn(() => Promise.resolve()),
      del: jest.fn(() => Promise.resolve()),
    };
    userModel = {
      aggregate: jest.fn(() => Promise.resolve([profile])),
      find: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CurrentUserService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: { get: jest.fn(() => TTL) } },
      ],
    }).compile();

    service = module.get(CurrentUserService);
  });

  describe('get', () => {
    it('devuelve lo cacheado sin consultar Mongo', async () => {
      redis.get.mockResolvedValue(profile);

      await expect(service.get(ID_SISCOUT)).resolves.toEqual(profile);
      expect(userModel.aggregate).not.toHaveBeenCalled();
    });

    /**
     * Redis es efímero a propósito (sin volumen, `allkeys-lru`, TTL propio), así
     * que el cache frío es un estado NORMAL: un reinicio, una evicción por
     * memoria o el vencimiento del TTL dejaban sin sesión utilizable a quien ya
     * había entrado, porque `seed` solo corre al validar la contraseña.
     */
    it('reconstruye el perfil desde Mongo cuando el cache está frío', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.get(ID_SISCOUT)).resolves.toEqual(profile);
      expect(userModel.aggregate).toHaveBeenCalledTimes(1);
    });

    it('repuebla el cache con lo que reconstruye', async () => {
      redis.get.mockResolvedValue(null);

      await service.get(ID_SISCOUT);

      expect(redis.set).toHaveBeenCalledWith(CACHE_KEY, profile, TTL);
    });

    it('falla solo si la persona tampoco está en Mongo', async () => {
      redis.get.mockResolvedValue(null);
      userModel.aggregate.mockResolvedValue([]);

      await expect(service.get(ID_SISCOUT)).rejects.toBeInstanceOf(
        AppNotFoundException,
      );
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('seed', () => {
    it('guarda el perfil recién construido', async () => {
      await service.seed(ID_SISCOUT);

      expect(redis.set).toHaveBeenCalledWith(CACHE_KEY, profile, TTL);
    });

    it('no guarda nada si la persona no existe', async () => {
      userModel.aggregate.mockResolvedValue([]);

      await service.seed(ID_SISCOUT);

      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('no resucita una entrada que ya no está en el cache', async () => {
      redis.has.mockResolvedValue(false);

      await service.refresh(ID_SISCOUT);

      expect(redis.updateExisting).not.toHaveBeenCalled();
    });
  });
});
