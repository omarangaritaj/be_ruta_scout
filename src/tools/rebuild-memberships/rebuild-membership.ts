import { DataSource } from 'typeorm';
import {
  projectMemberships,
  type ProjectableUnit,
} from '../../units/membership-projection';
import { UnitMembership } from '../../units/unit-membership.entity';

export async function rebuildUnitMembership(
  unit: ProjectableUnit,
  dataSource: DataSource,
): Promise<number> {
  const rows = projectMemberships(unit);

  await dataSource.transaction(async (manager) => {
    await manager.delete(UnitMembership, { unitId: unit.id });
    if (rows.length > 0) {
      await manager.insert(
        UnitMembership,
        rows.map((row) => ({
          userId: row.userId,
          unitId: row.unitId,
          role: row.role,
          groupId: row.groupId,
        })),
      );
    }
  });

  return rows.length;
}
