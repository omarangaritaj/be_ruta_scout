import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import {
  CREDENTIALS_CIPHER,
  FieldCipher,
  isEncrypted,
  parseKeyring,
  type EncryptedField,
} from '../../crypto';
import type { CreateSiscoutCredentialDto } from './dto/create-siscout-credential.dto';
import { SiscoutCredential } from './schemas/siscout-credential.schema';
import { SiscoutCredentialsService } from './siscout-credentials.service';

const VARIABLE = 'SISCOUT_CREDENTIALS_KEY';

function nuevoCipher(): FieldCipher {
  return new FieldCipher(
    parseKeyring(randomBytes(32).toString('base64'), VARIABLE),
    VARIABLE,
  );
}

function altaValida(
  overrides: Partial<CreateSiscoutCredentialDto> = {},
): CreateSiscoutCredentialDto {
  return {
    nombre: 'nacional',
    usuario: 'maestro@ejemplo.org',
    password: 'contraseña-secreta',
    changeRolPath: '/users/change-rol/826/176035/7',
    alcance: { tipo: 'nacional' },
    prioridad: 100,
    activa: true,
    ...overrides,
  };
}

/** Documento tal y como lo devolvería Mongo, con la contraseña ya cifrada. */
function documento(
  cipher: FieldCipher,
  overrides: Record<string, unknown> = {},
) {
  return {
    nombre: 'nacional',
    usuario: 'maestro@ejemplo.org',
    password: cipher.encrypt('contraseña-secreta'),
    changeRolPath: '/users/change-rol/826/176035/7',
    alcance: { tipo: 'nacional', zoneIds: [] },
    prioridad: 100,
    activa: true,
    ...overrides,
  };
}

describe('SiscoutCredentialsService', () => {
  let service: SiscoutCredentialsService;
  let cipher: FieldCipher;
  let model: {
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    deleteOne: jest.Mock;
    updateOne: jest.Mock;
  };

  /** Lo que `find()` devolverá en la próxima llamada. */
  let encontrados: Record<string, unknown>[];

  // Lo que el servicio ESCRIBIÓ, capturado al vuelo. Se guarda aquí en vez de
  // leerlo de `mock.calls` porque así llega tipado y el aserto se lee solo.
  let guardado: Record<string, unknown> | undefined;
  let patch: { $set: Record<string, unknown> } | undefined;

  async function montar(cifrador: FieldCipher) {
    cipher = cifrador;
    encontrados = [];
    guardado = undefined;
    patch = undefined;

    model = {
      create: jest.fn().mockImplementation((doc: Record<string, unknown>) => {
        guardado = doc;
        return Promise.resolve({ ...doc, toObject: () => doc });
      }),
      find: jest.fn().mockReturnValue({
        select: () => ({
          lean: () => ({ exec: () => Promise.resolve(encontrados) }),
        }),
        sort: () => ({
          lean: () => ({ exec: () => Promise.resolve(encontrados) }),
        }),
      }),
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(encontrados[0] ?? null) }),
      }),
      findOneAndUpdate: jest
        .fn()
        .mockImplementation(
          (_filtro: unknown, update: { $set: Record<string, unknown> }) => {
            patch = update;
            return {
              lean: () => ({
                exec: () => Promise.resolve(encontrados[0] ?? null),
              }),
            };
          },
        ),
      deleteOne: jest
        .fn()
        .mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 1 }) }),
      updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SiscoutCredentialsService,
        { provide: getModelToken(SiscoutCredential.name), useValue: model },
        { provide: CREDENTIALS_CIPHER, useValue: cipher },
      ],
    }).compile();

    service = moduleRef.get(SiscoutCredentialsService);
  }

  beforeEach(async () => {
    await montar(nuevoCipher());
  });

  describe('alta', () => {
    it('guarda la contraseña cifrada, nunca en claro', async () => {
      await service.create(altaValida());

      expect(isEncrypted(guardado?.password)).toBe(true);
      expect(JSON.stringify(guardado)).not.toContain('contraseña-secreta');
    });

    it('guarda una contraseña que se puede recuperar después', async () => {
      await service.create(altaValida());

      expect(cipher.decrypt(guardado?.password as EncryptedField)).toBe(
        'contraseña-secreta',
      );
    });

    it('no devuelve la contraseña en la respuesta', async () => {
      const vista = await service.create(altaValida());

      expect(vista).not.toHaveProperty('password');
      expect(JSON.stringify(vista)).not.toContain('contraseña-secreta');
    });

    it('traduce el nombre duplicado a un conflicto', async () => {
      model.create.mockRejectedValue({ code: 11000 });

      await expect(service.create(altaValida())).rejects.toThrow(
        ConflictException,
      );
    });

    it('falla sin clave en vez de guardar la contraseña en claro', async () => {
      await montar(new FieldCipher(null, VARIABLE));

      await expect(service.create(altaValida())).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(model.create).not.toHaveBeenCalled();
    });
  });

  describe('lectura', () => {
    it('no expone la contraseña al listar', async () => {
      encontrados = [
        documento(cipher),
        documento(cipher, { nombre: 'zona-7' }),
      ];

      const vistas = await service.findAll();

      expect(vistas).toHaveLength(2);
      for (const vista of vistas) {
        expect(vista).not.toHaveProperty('password');
      }
      expect(JSON.stringify(vistas)).not.toContain('contraseña-secreta');
    });

    it('no expone la contraseña al consultar una', async () => {
      encontrados = [documento(cipher)];

      const vista = await service.findOne('nacional');

      expect(vista).not.toHaveProperty('password');
      expect(vista.usuario).toBe('maestro@ejemplo.org');
    });

    it('avisa cuando la credencial no existe', async () => {
      encontrados = [];

      await expect(service.findOne('fantasma')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('actualización', () => {
    it('cifra la contraseña nueva antes de escribirla', async () => {
      encontrados = [documento(cipher)];

      await service.update('nacional', { password: 'otra-contraseña' });

      expect(isEncrypted(patch?.$set.password)).toBe(true);
      expect(cipher.decrypt(patch?.$set.password as EncryptedField)).toBe(
        'otra-contraseña',
      );
    });

    it('no toca la contraseña cuando el patch no la trae', async () => {
      encontrados = [documento(cipher)];

      await service.update('nacional', { activa: false });

      expect(patch?.$set).not.toHaveProperty('password');
      expect(patch?.$set.activa).toBe(false);
    });

    it('falla sin clave en vez de escribir la contraseña en claro', async () => {
      await montar(new FieldCipher(null, VARIABLE));
      encontrados = [];

      await expect(
        service.update('nacional', { password: 'otra' }),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('resolución para la sincronización', () => {
    it('descifra la contraseña al construir el login', async () => {
      encontrados = [documento(cipher)];

      const [credencial] = await service.resolveForZone(1);

      expect(credencial.password).toBe('contraseña-secreta');
      expect(credencial.usuario).toBe('maestro@ejemplo.org');
      expect(credencial.changeRolPath).toBe('/users/change-rol/826/176035/7');
    });

    it('antepone la credencial de zona a la nacional', async () => {
      encontrados = [
        documento(cipher, { nombre: 'nacional', prioridad: 1 }),
        documento(cipher, {
          nombre: 'zona-7',
          prioridad: 500,
          alcance: { tipo: 'zonas', zoneIds: [7] },
        }),
      ];

      const orden = (await service.resolveForZone(7)).map((c) => c.nombre);

      // La de zona gana pese a tener MUCHA peor prioridad: el criterio manda
      // sobre el desempate, no al revés. Menos privilegio primero.
      expect(orden).toEqual(['zona-7', 'nacional']);
    });

    it('ordena por prioridad dentro del mismo alcance', async () => {
      encontrados = [
        documento(cipher, { nombre: 'respaldo', prioridad: 200 }),
        documento(cipher, { nombre: 'principal', prioridad: 10 }),
      ];

      const orden = (await service.resolveForZone(1)).map((c) => c.nombre);

      expect(orden).toEqual(['principal', 'respaldo']);
    });

    it('desempata por nombre para que el orden no varíe entre corridas', async () => {
      encontrados = [
        documento(cipher, { nombre: 'beta', prioridad: 100 }),
        documento(cipher, { nombre: 'alfa', prioridad: 100 }),
      ];

      const orden = (await service.resolveForZone(1)).map((c) => c.nombre);

      expect(orden).toEqual(['alfa', 'beta']);
    });

    it('pide a Mongo solo las activas que cubren la zona', async () => {
      encontrados = [documento(cipher)];

      await service.resolveForZone(7);

      expect(model.find).toHaveBeenCalledWith({
        activa: true,
        $or: [
          { 'alcance.tipo': 'nacional' },
          { 'alcance.tipo': 'zonas', 'alcance.zoneIds': 7 },
        ],
      });
    });

    it('rechaza una credencial con la contraseña sin cifrar', async () => {
      // Un documento manipulado a mano en la base, o escrito por una versión
      // anterior: se descarta en vez de mandarla en claro contra el login.
      encontrados = [documento(cipher, { password: 'en-claro' })];

      await expect(service.resolveForZone(1)).rejects.toThrow(
        /tiene la contraseña sin cifrar/,
      );
    });

    it('no resuelve nada sin la clave que descifra', async () => {
      await montar(new FieldCipher(null, VARIABLE));

      await expect(service.resolveForZone(1)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(model.find).not.toHaveBeenCalled();
    });

    it('devuelve la lista vacía cuando ninguna cubre la zona', async () => {
      encontrados = [];

      expect(await service.resolveForZone(99)).toEqual([]);
    });
  });

  describe('isReady', () => {
    it('sigue el estado del cifrador', async () => {
      expect(service.isReady()).toBe(true);

      await montar(new FieldCipher(null, VARIABLE));

      expect(service.isReady()).toBe(false);
    });
  });
});
