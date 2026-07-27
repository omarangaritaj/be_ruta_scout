import { Types } from 'mongoose';
import { rebuildUnitMembership } from './rebuild-membership';

function makeSession() {
  return {
    withTransaction: jest.fn((work: () => Promise<unknown>) => work()),
    endSession: jest.fn(() => Promise.resolve()),
  };
}

describe('rebuildUnitMembership', () => {
  it('borra e inserta las filas de la unidad dentro de la misma sesion de transaccion', async () => {
    const session = makeSession();
    const connection = {
      startSession: jest.fn(() => Promise.resolve(session)),
    };
    const membershipModel = {
      deleteMany: jest.fn(() => Promise.resolve({})),
      insertMany: jest.fn(() => Promise.resolve([])),
    };

    const unitId = new Types.ObjectId();
    const unitLeaderId = new Types.ObjectId();
    const memberId = new Types.ObjectId();

    const rowCount = await rebuildUnitMembership(
      {
        _id: unitId.toString(),
        groupId: 304,
        unitLeaderId: unitLeaderId.toString(),
        leaders: [],
        members: [memberId.toString()],
      },
      membershipModel as never,
      connection as never,
    );

    expect(rowCount).toBe(2);
    expect(connection.startSession).toHaveBeenCalledTimes(1);
    expect(session.withTransaction).toHaveBeenCalledTimes(1);

    const [deleteFilter, deleteOptions] = membershipModel.deleteMany.mock
      .calls[0] as unknown as [
      { unitId: Types.ObjectId },
      { session: unknown },
    ];
    expect(deleteFilter.unitId.toString()).toBe(unitId.toString());
    expect(deleteOptions.session).toBe(session);

    const [insertDocs, insertOptions] = membershipModel.insertMany.mock
      .calls[0] as unknown as [unknown[], { session: unknown }];
    expect(insertDocs).toHaveLength(2);
    expect(insertOptions.session).toBe(session);

    expect(membershipModel.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      membershipModel.insertMany.mock.invocationCallOrder[0],
    );

    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('cierra la sesion aunque la transaccion falle, y propaga el error', async () => {
    const session = makeSession();
    const connection = {
      startSession: jest.fn(() => Promise.resolve(session)),
    };
    const failure = new Error('conexion perdida con Atlas');
    const membershipModel = {
      deleteMany: jest.fn(() => Promise.reject(failure)),
      insertMany: jest.fn(() => Promise.resolve([])),
    };

    await expect(
      rebuildUnitMembership(
        {
          _id: new Types.ObjectId().toString(),
          groupId: 304,
          unitLeaderId: new Types.ObjectId().toString(),
          leaders: [],
          members: [],
        },
        membershipModel as never,
        connection as never,
      ),
    ).rejects.toThrow(failure);

    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});
