import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Asistencia } from '../asistencia/asistencia.schema';
import { UnitMembership } from '../units/schemas/unit-membership.schema';
import { User } from '../users/schemas/user.schema';
import type { WriteOp } from './dto/write-batch.dto';
import { PowersyncService } from './powersync.service';

const validData = {
  unitId: 'U1',
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
};
/**
 * Un dirigente NUNCA tiene `users.unitId`: ese puntero solo se escribe para los
 * protagonistas. Su alcance sale de `unit_memberships`, y por eso el doble lo
 * deja explícitamente sin unitId.
 */
const dirigente = {
  estadoAcceso: 'aprobado',
  nivelAcceso: 'grupo',
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

  async function make(
    actor: unknown,
    existing: unknown = null,
    unitIds: string[] = [],
  ) {
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
    const membershipModel = {
      find: jest.fn(() => ({
        select: () => ({
          lean: () => ({
            exec: () => Promise.resolve(unitIds.map((unitId) => ({ unitId }))),
          }),
        }),
      })),
    };

    const ref = await Test.createTestingModule({
      providers: [
        PowersyncService,
        { provide: getModelToken(Asistencia.name), useValue: asistencia },
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: getModelToken(UnitMembership.name),
          useValue: membershipModel,
        },
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
      unitId: 'U1',
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
    await make(dirigente, null, ['U1']);
    await expect(
      service.applyWrites('d', [put({ ...validData, unitId: 'U2' })]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un dirigente sí escribe asistencia de la unidad donde tiene membresía', async () => {
    await make(dirigente, null, ['U1']);
    await service.applyWrites('d', [put(validData)]);
    expect(asistencia.updateOne).toHaveBeenCalledTimes(1);
  });

  it('un subjefe de varias unidades escribe en todas ellas', async () => {
    await make(dirigente, null, ['U1', 'U2']);
    await service.applyWrites('d', [put({ ...validData, unitId: 'U2' })]);
    expect(asistencia.updateOne).toHaveBeenCalledTimes(1);
  });

  it('sin ninguna membresía no se escribe nada', async () => {
    await make(dirigente, null, []);
    await expect(
      service.applyWrites('d', [put(validData)]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza si faltan campos requeridos', async () => {
    await make(superAdmin);
    await expect(
      service.applyWrites('a', [put({ unitId: 'U1' })]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('DELETE borra cuando el scope lo permite', async () => {
    await make(superAdmin, { unitId: 'U1' });
    await service.applyWrites('a', [
      { op: 'DELETE', table: 'asistencia', id: 'row-1' },
    ]);
    expect(asistencia.deleteOne).toHaveBeenCalledWith({ _id: 'row-1' });
  });
});
