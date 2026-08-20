import { D, type UnitRole } from '../domain';

export interface ProjectableUnit {
  id: string;
  groupId: number;
  leaderId: string;
  leaders: string[];
  members: string[];
}

export interface MembershipRow {
  userId: string;
  unitId: string;
  role: UnitRole;
  groupId: number;
}

export function projectMemberships(unit: ProjectableUnit): MembershipRow[] {
  const seen = new Set<string>();
  const rows: MembershipRow[] = [];

  const add = (userId: string, role: UnitRole) => {
    if (seen.has(userId)) return;
    seen.add(userId);
    rows.push({ userId, unitId: unit.id, role, groupId: unit.groupId });
  };

  add(unit.leaderId, D.UNIT_ROLE.UNIT_LEADER);
  unit.leaders.forEach((id) => add(id, D.UNIT_ROLE.ASSISTANT));
  unit.members.forEach((id) => add(id, D.UNIT_ROLE.MEMBER));

  return rows;
}
