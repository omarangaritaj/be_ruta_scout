import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Asistencia } from '../asistencia/asistencia.schema';
import { User } from '../users/schemas/user.schema';
import type { WriteOp } from './dto/write-batch.dto';
import { PowersyncService } from './powersync.service';

const validData = {
  idUnidad: 'U1',
  idProtagonista: 'P1',
  fecha: '2026-07-26T10:00:00.000Z',
  presente: true,
};

function put(data: Record<string, unknown>): WriteOp {
  return { op: 'PUT', table: 'asistencia', id: 'row-1', data };
}

const superAdmin = {
  estadoAcceso: 'aprobado',
  nivelAcceso: 'super_admin',
  unitId: null,
};
const dirigente = {
  estadoAcceso: 'aprobado',
  nivelAcceso: 'grupo',
  unitId: 'U1',
};

describe('PowersyncService', () => {
  let service: PowersyncService;
  let asistencia: {
    updateOne: jest.Mock;
    deleteOne: jest.Mock;
    findById: jest.Mock;
  };
  let lastUpsert: {
    filter: Record<string, unknown>;
    set: Record<string, unknown>;
  } | null;

  async function make(actor: unknown, existing: unknown = null) {
    lastUpsert = null;
    asistencia = {
      updateOne: jest.fn(
        (
          filter: Record<string, unknown>,
          update: { $set: Record<string, unknown> },
        ) => {
          lastUpsert = { filter, set: update.$set };
          return { exec: () => Promise.resolve({}) };
        },
      ),
      deleteOne: jest.fn(() => ({ exec: () => Promise.resolve({}) })),
      findById: jest.fn(() => ({ exec: () => Promise.resolve(existing) })),
    };
    const userModel = {
      findById: jest.fn(() => ({ exec: () => Promise.resolve(actor) })),
    };

    const ref = await Test.createTestingModule({
      providers: [
        PowersyncService,
        { provide: getModelToken(Asistencia.name), useValue: asistencia },
        { provide: getModelToken(User.name), useValue: userModel },
      ],
    }).compile();
    service = ref.get(PowersyncService);
  }

  it('rechaza si el actor no existe', async () => {
    await make(null);
    await expect(
      service.applyWrites('x', [put(validData)]),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza si el actor no está aprobado', async () => {
    await make({ estadoAcceso: 'pendiente' });
    await expect(
      service.applyWrites('x', [put(validData)]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza una tabla no soportada', async () => {
    await make(superAdmin);
    await expect(
      service.applyWrites('x', [
        { op: 'PUT', table: 'otra', id: 'r', data: {} },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('super_admin escribe asistencia de cualquier unidad (upsert por _id)', async () => {
    await make(superAdmin);
    await service.applyWrites('admin', [put(validData)]);

    expect(asistencia.updateOne).toHaveBeenCalledTimes(1);
    expect(lastUpsert?.filter).toEqual({ _id: 'row-1' });
    expect(lastUpsert?.set).toMatchObject({
      idUnidad: 'U1',
      idProtagonista: 'P1',
      presente: true,
      registradoPor: 'admin',
    });
  });

  it('interpreta presente como 0/1 (integer del SQLite del cliente)', async () => {
    await make(superAdmin);
    await service.applyWrites('a', [put({ ...validData, presente: 0 })]);
    expect(lastUpsert?.set.presente).toBe(false);
  });

  it('un dirigente NO puede escribir asistencia de otra unidad', async () => {
    await make(dirigente);
    await expect(
      service.applyWrites('d', [put({ ...validData, idUnidad: 'U2' })]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un dirigente sí escribe asistencia de su propia unidad', async () => {
    await make(dirigente);
    await service.applyWrites('d', [put(validData)]);
    expect(asistencia.updateOne).toHaveBeenCalledTimes(1);
  });

  it('rechaza si faltan campos requeridos', async () => {
    await make(superAdmin);
    await expect(
      service.applyWrites('a', [put({ idUnidad: 'U1' })]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('DELETE borra cuando el scope lo permite', async () => {
    await make(superAdmin, { idUnidad: 'U1' });
    await service.applyWrites('a', [
      { op: 'DELETE', table: 'asistencia', id: 'row-1' },
    ]);
    expect(asistencia.deleteOne).toHaveBeenCalledWith({ _id: 'row-1' });
  });
});
