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

/**
 * Protagonista cuyo `cargoSiscout` no está en el catálogo de alias de rama. Se
 * queda sin unidad y hay que reportarlo: el texto va **literal**, sin
 * normalizar, porque es justo lo que hace falta para ampliar el catálogo.
 */
export interface DiscardedPerson {
  _id: string;
  name: string;
  cargoSiscout?: string;
}

export interface SeedPlan {
  units: PlannedUnit[];
  discarded: DiscardedPerson[];
  skipped?: SeedSkipReason;
}

export function placeholderName(branch: Branch, index = 1): string {
  const base = `cambiar nombre unidad ${branch}`;
  return index > 1 ? `${base} ${index}` : base;
}

interface Classification {
  grouped: Map<Branch, string[]>;
  discarded: DiscardedPerson[];
}

function classifyProtagonists(people: SeedPerson[]): Classification {
  const grouped = new Map<Branch, string[]>();
  const discarded: DiscardedPerson[] = [];

  for (const person of people) {
    if (person.tipo !== D.PERSON_TYPE.PROTAGONIST) continue;
    const branch = ramaDeEtiquetaSiscout(person.cargoSiscout);
    if (!branch) {
      discarded.push({
        _id: person._id,
        name: person.name,
        cargoSiscout: person.cargoSiscout,
      });
      continue;
    }
    grouped.set(branch, [...(grouped.get(branch) ?? []), person._id]);
  }

  return { grouped, discarded };
}

export function planGroupSeed({ groupId, people }: SeedInput): SeedPlan {
  if (people.length === 0) {
    return { units: [], discarded: [], skipped: 'no-people' };
  }

  const { grouped, discarded } = classifyProtagonists(people);

  const adults = people.filter((p) => p.tipo === D.PERSON_TYPE.ADULT);
  if (adults.length === 0) {
    return { units: [], discarded, skipped: 'no-adults' };
  }

  if (grouped.size === 0) {
    return { units: [], discarded, skipped: 'no-protagonists' };
  }

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

  return { units, discarded };
}
