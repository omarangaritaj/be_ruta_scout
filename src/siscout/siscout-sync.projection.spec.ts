import { randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  CEDULA_HASHER,
  CedulaHasher,
  SNAPSHOT_CIPHER,
  FieldCipher,
  parseKeyring,
} from '../crypto';
import { User } from '../users/schemas/user.schema';
import { SiscoutConfigService } from './config/siscout-config.service';
import { SiscoutCredentialsService } from './credentials';
import { normalizeMember } from './normalize';
import { SiscoutClient } from './ports/siscout-client.port';
import { SiscoutSnapshot } from './schemas/siscout-snapshot.schema';
import { SiscoutSyncService } from './siscout-sync.service';

/**
 * Pruebas de la PROYECCIÓN al documento público (`users`).
 *
 * Lo que se vigila aquí es la lista blanca: que salga lo que debe salir, que
 * NO salga la PII, y que un campo retirado en el origen se limpie en vez de
 * quedarse en pie. Un cargo obsoleto no es un dato viejo cualquiera: de él
 * cuelgan permisos.
 *
 * Se ejercita con `importMembers` porque hace la MISMA escritura que una
 * sincronización real sin necesitar red ni credenciales.
 */

function miembro(overrides: Record<string, unknown> = {}) {
  return normalizeMember({
    person_id: 'p-1',
    citizenship_card: '1013599123',
    nombre: 'Andrés Muñoz',
    tipomiembro: 'MIEMBRO ACTIVO ADULTO',
    cargo: 'JEFE DE GRUPO',
    telefono: '3001234567',
    email: 'andres@ejemplo.org',
    group_id: 42,
    group_name: 'GRUPO 42',
    district_id: 7,
    district_name: 'REGIÓN 7',
    zone_id: 7,
    ...overrides,
  });
}

describe('SiscoutSyncService — proyección al documento público', () => {
  let service: SiscoutSyncService;
  let userModel: { bulkWrite: jest.Mock; updateMany: jest.Mock };
  let snapshotModel: { find: jest.Mock; bulkWrite: jest.Mock };

  /** Update del primer `updateOne` que el sync mandó a `users`. */
  const userUpdate = (): {
    $set: Record<string, unknown>;
    $unset: Record<string, unknown>;
    $setOnInsert: Record<string, unknown>;
  } => {
    const [ops] = userModel.bulkWrite.mock.calls[0] as Array<
      Array<{ updateOne: { update: Record<string, never> } }>
    >;
    return ops[0].updateOne.update as never;
  };

  beforeEach(async () => {
    userModel = {
      bulkWrite: jest.fn().mockResolvedValue({}),
      updateMany: jest
        .fn()
        .mockReturnValue({ exec: () => Promise.resolve({ modifiedCount: 0 }) }),
    };

    snapshotModel = {
      find: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve([]) }),
      }),
      bulkWrite: jest.fn().mockResolvedValue({}),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SiscoutSyncService,
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: getModelToken(SiscoutSnapshot.name),
          useValue: snapshotModel,
        },
        { provide: SiscoutClient, useValue: {} },
        {
          provide: SNAPSHOT_CIPHER,
          useValue: new FieldCipher(
            parseKeyring(
              randomBytes(32).toString('base64'),
              'SISCOUT_ENCRYPTION_KEY',
            ),
            'SISCOUT_ENCRYPTION_KEY',
          ),
        },
        {
          provide: CEDULA_HASHER,
          useValue: new CedulaHasher(
            parseKeyring(randomBytes(32).toString('base64'), 'CEDULA_HASH_KEY'),
          ),
        },
        {
          provide: SiscoutConfigService,
          useValue: {
            ensureLoaded: jest.fn().mockResolvedValue(undefined),
            get: jest.fn().mockReturnValue({ writeChunkSize: 500 }),
          },
        },
        { provide: SiscoutCredentialsService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(SiscoutSyncService);
  });

  it('proyecta el cargo de SiScout a `cargoSiscout`', async () => {
    await service.importMembers([miembro()]);

    expect(userUpdate().$set).toMatchObject({
      cargoSiscout: 'JEFE DE GRUPO',
      name: 'Andrés Muñoz',
      groupId: 42,
      districtId: 7,
    });
  });

  it('limpia `cargoSiscout` cuando SiScout deja de reportar el cargo', async () => {
    await service.importMembers([miembro({ cargo: null })]);

    // Ignorar el nulo dejaría en pie un cargo que la organización ya retiró, y
    // con él los permisos que de ahí cuelgan.
    expect(userUpdate().$unset).toMatchObject({ cargoSiscout: '' });
    expect(userUpdate().$set).not.toHaveProperty('cargoSiscout');
  });

  it('no expone la PII del miembro en el documento público', async () => {
    await service.importMembers([miembro()]);

    const proyectado = userUpdate().$set;
    expect(proyectado).not.toHaveProperty('citizenship_card');
    expect(proyectado).not.toHaveProperty('telefono');
    expect(proyectado).not.toHaveProperty('email');
  });

  it('no toca los `cargos` que gestiona la aplicación', async () => {
    await service.importMembers([miembro()]);

    // `cargos` es decisión NUESTRA: el sync solo lo inicializa al crear. Si lo
    // escribiera en cada corrida borraría lo que asignó un administrador.
    expect(userUpdate().$set).not.toHaveProperty('cargos');
    expect(userUpdate().$setOnInsert).toMatchObject({ cargos: [] });
  });

  it('guarda el cargo sin cifrar en el snapshot', async () => {
    await service.importMembers([miembro()]);

    const [ops] = snapshotModel.bulkWrite.mock.calls[0] as Array<
      Array<{
        updateOne: { update: { $set: { payload: SiscoutMemberPayload } } };
      }>
    >;
    const { payload } = ops[0].updateOne.update.$set;

    // La detección de cambios de cargo lee el snapshot previo sin descifrar.
    expect(payload.cargo).toBe('JEFE DE GRUPO');
    expect(payload.email).not.toBe('andres@ejemplo.org');
  });
});

interface SiscoutMemberPayload {
  cargo: string;
  email: string;
}
