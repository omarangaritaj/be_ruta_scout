import { randomBytes } from 'node:crypto';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { FieldCipher, SNAPSHOT_CIPHER, parseKeyring } from '../crypto';
import { encryptSensitiveFields } from './crypto/encrypted-fields';
import type { SiscoutMember } from './normalize';
import { SiscoutSnapshot } from './schemas/siscout-snapshot.schema';
import { SiscoutSnapshotService } from './siscout-snapshot.service';

const VARIABLE = 'SISCOUT_ENCRYPTION_KEY';

function nuevoCipher(): FieldCipher {
  return new FieldCipher(
    parseKeyring(randomBytes(32).toString('base64'), VARIABLE),
    VARIABLE,
  );
}

function miembro(): SiscoutMember {
  return {
    person_id: '176035',
    citizenship_card: '1013599123',
    nombre: 'Andrés Muñoz',
    sex: 'M',
    telefono: '3001234567',
    email: 'andres@ejemplo.org',
    cargo: 'JEFE DE GRUPO',
    cargo_id: null,
    tipomiembro: 'MIEMBRO ACTIVO ADULTO',
    group_id: 42,
    group_name: 'Grupo 42',
    district_id: 8,
    district_name: 'Distrito 8',
    zone_id: 1,
  };
}

describe('SiscoutSnapshotService', () => {
  let service: SiscoutSnapshotService;
  let cipher: FieldCipher;
  let model: { findOne: jest.Mock };

  /** Lo que Mongo devolverá en la próxima consulta. */
  let almacenado: { payload: Record<string, unknown> } | null;

  beforeEach(async () => {
    cipher = nuevoCipher();
    almacenado = null;

    model = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(almacenado) }),
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SiscoutSnapshotService,
        { provide: getModelToken(SiscoutSnapshot.name), useValue: model },
        { provide: SNAPSHOT_CIPHER, useValue: cipher },
      ],
    }).compile();

    service = moduleRef.get(SiscoutSnapshotService);
  });

  it('devuelve la PII en claro a quien la pide', async () => {
    almacenado = { payload: encryptSensitiveFields(miembro(), cipher) };

    const recuperado = await service.findDecrypted('176035');

    expect(recuperado).toEqual(miembro());
  });

  it('pide solo el payload, sin arrastrar el documento entero', async () => {
    almacenado = { payload: encryptSensitiveFields(miembro(), cipher) };

    await service.findDecrypted('176035');

    expect(model.findOne).toHaveBeenCalledWith(
      { idSiscout: '176035' },
      { payload: 1, _id: 0 },
    );
  });

  it('devuelve null cuando no hay snapshot de esa persona', async () => {
    almacenado = null;

    expect(await service.findDecrypted('no-existe')).toBeNull();
  });

  it('tolera un payload guardado antes del cifrado', async () => {
    // Documento heredado: no hay nada que descifrar y tampoco nada que romper.
    almacenado = { payload: { ...miembro() } };

    const recuperado = await service.findDecrypted('176035');

    expect(recuperado?.citizenship_card).toBe('1013599123');
  });

  it('falla si la clave ya no abre lo que hay guardado', async () => {
    almacenado = { payload: encryptSensitiveFields(miembro(), cipher) };

    // La clave se rotó y se descartó la anterior sin migrar los datos.
    const moduleRef = await Test.createTestingModule({
      providers: [
        SiscoutSnapshotService,
        { provide: getModelToken(SiscoutSnapshot.name), useValue: model },
        { provide: SNAPSHOT_CIPHER, useValue: nuevoCipher() },
      ],
    }).compile();

    const otro = moduleRef.get(SiscoutSnapshotService);

    // Revienta en lugar de devolver basura: un descifrado silenciosamente malo
    // sería mucho peor que un error.
    await expect(otro.findDecrypted('176035')).rejects.toThrow();
  });
});
