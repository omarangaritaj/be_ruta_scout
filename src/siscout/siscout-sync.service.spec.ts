import { randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SNAPSHOT_CIPHER, FieldCipher, parseKeyring } from '../crypto';
import { User } from '../users/schemas/user.schema';
import { SiscoutConfigService } from './config/siscout-config.service';
import {
  SiscoutCredentialsService,
  type SiscoutCredentialAuth,
} from './credentials';
import { SiscoutClient } from './ports/siscout-client.port';
import { SiscoutSnapshot } from './schemas/siscout-snapshot.schema';
import { SiscoutSyncService } from './siscout-sync.service';

/**
 * Pruebas del motor de sincronización centradas en la ELECCIÓN DE CREDENCIAL.
 *
 * Es la parte que más silenciosamente puede fallar: si la resolución escoge mal
 * o el failover no salta, la corrida no revienta — descarga de menos y la
 * consolidación marca huérfana a gente que sigue activa.
 *
 * Todo lo externo va con dobles: no hay Mongo ni red.
 */

function credencial(
  nombre: string,
  usuario = `${nombre}@ejemplo.org`,
): SiscoutCredentialAuth {
  return {
    nombre,
    usuario,
    password: 'secreta',
    changeRolPath: `/users/change-rol/${nombre}`,
  };
}

/** Fila cruda de `listar-miembros`, con lo mínimo para pasar las guardas. */
function miembro(personId: string, zoneId: number) {
  return {
    person_id: personId,
    citizenship_card: '1013599123',
    nombre: 'Andrés Muñoz',
    tipomiembro: 'MIEMBRO ACTIVO ADULTO',
    cargo: 'JEFE DE GRUPO',
    telefono: '3001234567',
    email: 'andres@ejemplo.org',
    group_id: 42,
    zone_id: zoneId,
  };
}

describe('SiscoutSyncService — elección de credencial', () => {
  let service: SiscoutSyncService;
  let client: {
    isConfigured: jest.Mock;
    authenticate: jest.Mock;
    listZoneMembers: jest.Mock;
  };
  let credentials: {
    isReady: jest.Mock;
    resolveForZone: jest.Mock;
    registrarUso: jest.Mock;
    registrarError: jest.Mock;
  };
  let config: { ensureLoaded: jest.Mock; get: jest.Mock };

  /** Zonas que la configuración dice descargar en cada prueba. */
  let zonas: number[];

  beforeEach(async () => {
    zonas = [7];

    client = {
      isConfigured: jest.fn().mockReturnValue(true),
      authenticate: jest.fn().mockResolvedValue('siscout_session=abc'),
      listZoneMembers: jest.fn().mockImplementation((_cookie, zoneId: number) =>
        Promise.resolve({
          recordsTotal: 1,
          recordsFiltered: 1,
          data: [miembro(`p-${zoneId}`, zoneId)],
        }),
      ),
    };

    credentials = {
      isReady: jest.fn().mockReturnValue(true),
      resolveForZone: jest.fn().mockResolvedValue([credencial('nacional')]),
      registrarUso: jest.fn().mockResolvedValue(undefined),
      registrarError: jest.fn().mockResolvedValue(undefined),
    };

    config = {
      ensureLoaded: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockImplementation(() => ({
        zoneIds: zonas,
        pageLength: 4000,
        maxPages: 3,
        // El mínimo de la zona principal se baja a 1: aquí se prueba la
        // elección de credencial, no la guarda de volumen.
        minMainZoneRecords: 1,
        writeChunkSize: 500,
        syncCron: '0 3 * * *',
        syncEnabled: false,
      })),
    };

    const userModel = {
      bulkWrite: jest.fn().mockResolvedValue({}),
      updateMany: jest
        .fn()
        .mockReturnValue({ exec: () => Promise.resolve({ modifiedCount: 0 }) }),
    };

    const snapshotModel = {
      find: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve([]) }),
      }),
      bulkWrite: jest.fn().mockResolvedValue({}),
    };

    const cipher = new FieldCipher(
      parseKeyring(
        randomBytes(32).toString('base64'),
        'SISCOUT_ENCRYPTION_KEY',
      ),
      'SISCOUT_ENCRYPTION_KEY',
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        SiscoutSyncService,
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: getModelToken(SiscoutSnapshot.name),
          useValue: snapshotModel,
        },
        { provide: SiscoutClient, useValue: client },
        { provide: SNAPSHOT_CIPHER, useValue: cipher },
        { provide: SiscoutConfigService, useValue: config },
        { provide: SiscoutCredentialsService, useValue: credentials },
      ],
    }).compile();

    service = moduleRef.get(SiscoutSyncService);
  });

  it('se autentica con la primera credencial que devuelve el pool', async () => {
    credentials.resolveForZone.mockResolvedValue([
      credencial('zona-7'),
      credencial('nacional'),
    ]);

    const result = await service.synchronize();

    expect(result.error).toBeUndefined();
    expect(result.complete).toBe(true);
    expect(client.authenticate).toHaveBeenCalledTimes(1);
    expect(client.authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'zona-7' }),
    );
    expect(result.credencialesPorZona).toEqual({ 7: 'zona-7' });
    expect(credentials.registrarUso).toHaveBeenCalledWith('zona-7');
  });

  it('pasa a la siguiente credencial cuando el login falla', async () => {
    credentials.resolveForZone.mockResolvedValue([
      credencial('zona-7'),
      credencial('nacional'),
    ]);
    client.authenticate
      .mockRejectedValueOnce(new Error('credenciales incorrectas'))
      .mockResolvedValueOnce('siscout_session=abc');

    const result = await service.synchronize();

    expect(result.complete).toBe(true);
    expect(result.credencialesPorZona).toEqual({ 7: 'nacional' });
    expect(credentials.registrarError).toHaveBeenCalledWith(
      'zona-7',
      'credenciales incorrectas',
    );
    expect(credentials.registrarUso).toHaveBeenCalledWith('nacional');
  });

  it('reutiliza la sesión cuando la misma credencial cubre varias zonas', async () => {
    zonas = [1, 2, 3];
    credentials.resolveForZone.mockResolvedValue([credencial('nacional')]);

    const result = await service.synchronize();

    expect(result.complete).toBe(true);
    // Tres zonas, UN solo login: la sesión se comparte.
    expect(client.authenticate).toHaveBeenCalledTimes(1);
    expect(client.listZoneMembers).toHaveBeenCalledTimes(3);
    expect(result.credencialesPorZona).toEqual({
      1: 'nacional',
      2: 'nacional',
      3: 'nacional',
    });
  });

  it('no reintenta una credencial que ya falló en otra zona', async () => {
    zonas = [1, 2];
    credentials.resolveForZone.mockResolvedValue([
      credencial('caida'),
      credencial('nacional'),
    ]);
    client.authenticate
      .mockRejectedValueOnce(new Error('502'))
      .mockResolvedValue('siscout_session=abc');

    const result = await service.synchronize();

    expect(result.complete).toBe(true);
    // Dos logins y no tres: la credencial caída se descarta para el resto de
    // la corrida en lugar de volver a intentarse en cada zona.
    expect(client.authenticate).toHaveBeenCalledTimes(2);
    expect(result.credencialesPorZona).toEqual({
      1: 'nacional',
      2: 'nacional',
    });
  });

  it('aborta sin escribir cuando ninguna credencial cubre la zona', async () => {
    credentials.resolveForZone.mockResolvedValue([]);

    const result = await service.synchronize();

    expect(result.complete).toBe(false);
    expect(result.error).toMatch(/no hay ninguna credencial activa/);
    expect(client.authenticate).not.toHaveBeenCalled();
    // Sin corrida completa no se consolidan huérfanos.
    expect(result.orphans).toBe(0);
  });

  it('aborta cuando todas las credenciales fallan e informa de cada intento', async () => {
    credentials.resolveForZone.mockResolvedValue([
      credencial('zona-7'),
      credencial('nacional'),
    ]);
    client.authenticate.mockRejectedValue(new Error('502 Bad Gateway'));

    const result = await service.synchronize();

    expect(result.complete).toBe(false);
    expect(result.error).toMatch(/ninguna credencial pudo autenticarse/);
    expect(result.error).toMatch(/zona-7 \(502 Bad Gateway\)/);
    expect(result.error).toMatch(/nacional \(502 Bad Gateway\)/);
    expect(result.orphans).toBe(0);
  });

  it('no sincroniza sin la clave que descifra las credenciales', async () => {
    credentials.isReady.mockReturnValue(false);

    await expect(service.synchronize()).rejects.toThrow(
      /SISCOUT_CREDENTIALS_KEY/,
    );
    expect(client.authenticate).not.toHaveBeenCalled();
  });
});
