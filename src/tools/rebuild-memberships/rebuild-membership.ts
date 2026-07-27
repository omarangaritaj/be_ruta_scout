import { Connection, Model, Types } from 'mongoose';
import {
  projectMemberships,
  type ProjectableUnit,
} from '../../units/membership-projection';
import type { UnitMembershipDocument } from '../../units/schemas/unit-membership.schema';

export async function rebuildUnitMembership(
  unit: ProjectableUnit,
  membershipModel: Model<UnitMembershipDocument>,
  connection: Connection,
): Promise<number> {
  const rows = projectMemberships(unit);
  const unitId = new Types.ObjectId(unit._id);

  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      await membershipModel.deleteMany({ unitId }, { session });
      if (rows.length > 0) {
        await membershipModel.insertMany(
          rows.map((row) => ({
            userId: new Types.ObjectId(row.userId),
            unitId: new Types.ObjectId(row.unitId),
            role: row.role,
            groupId: row.groupId,
          })),
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return rows.length;
}
