import { ramaDeEtiquetaSiscout } from '../../catalogo-cargos/ramas';
import { BRANCHES, D, type Branch } from '../../domain';
import { resolveUnitLeader, type LeaderCandidate } from './leader-resolution';

export interface SeedPerson extends LeaderCandidate {
  tipo: string;
  districtId?: number;
  districtName?: string;
}

export interface SeedInput {
  groupId: number;
  people: SeedPerson[];
}

export interface PlannedUnit {
  name: string;
  branch: Branch;
  groupId: number;
  districtId?: number;
  districtName?: string;
  unitLeaderId: string;
  leaders: string[];
  members: string[];
}

export type SeedSkipReason = 'no-people' | 'no-adults' | 'no-protagonists';

export interface SeedPlan {
  units: PlannedUnit[];
  skipped?: SeedSkipReason;
}

export function placeholderName(branch: Branch, index = 1): string {
  const base = `cambiar nombre unidad ${branch}`;
  return index > 1 ? `${base} ${index}` : base;
}

function membersByBranch(people: SeedPerson[]): Map<Branch, string[]> {
  const grouped = new Map<Branch, string[]>();

  for (const person of people) {
    if (person.tipo !== D.PERSON_TYPE.PROTAGONIST) continue;
    const branch = ramaDeEtiquetaSiscout(person.cargoSiscout);
    if (!branch) continue;
    grouped.set(branch, [...(grouped.get(branch) ?? []), person._id]);
  }

  return grouped;
}

export function planGroupSeed({ groupId, people }: SeedInput): SeedPlan {
  if (people.length === 0) return { units: [], skipped: 'no-people' };

  const adults = people.filter((p) => p.tipo === D.PERSON_TYPE.ADULT);
  if (adults.length === 0) return { units: [], skipped: 'no-adults' };

  const grouped = membersByBranch(people);
  if (grouped.size === 0) return { units: [], skipped: 'no-protagonists' };

  const withDistrict = people.find((p) => p.districtId !== undefined);

  const units = BRANCHES.filter((branch) => grouped.has(branch)).map(
    (branch): PlannedUnit => ({
      name: placeholderName(branch),
      branch,
      groupId,
      districtId: withDistrict?.districtId,
      districtName: withDistrict?.districtName,
      unitLeaderId: resolveUnitLeader(branch, adults)!._id,
      leaders: [],
      members: grouped.get(branch)!,
    }),
  );

  return { units };
}
