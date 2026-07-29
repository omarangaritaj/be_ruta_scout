import { ramaDeEtiquetaSiscout } from '../../catalogo-cargos/ramas';
import { BRANCHES, D, branchFromAge, type Branch } from '../../domain';
import {
  leadersOfBranch,
  resolveUnitLeader,
  type LeaderCandidate,
} from './leader-resolution';

export interface SeedPerson extends LeaderCandidate {
  tipo: string;
  age?: number;
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
 * Protagonista al que no se le pudo deducir la rama ni por su `cargoSiscout` ni
 * por su edad. Se queda sin unidad y hay que reportarlo: el texto va
 * **literal**, sin normalizar, porque es justo lo que hace falta para ampliar
 * el catálogo de alias.
 */
export interface DiscardedPerson {
  _id: string;
  name: string;
  cargoSiscout?: string;
  age?: number;
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

/**
 * Rama del protagonista: primero su `cargoSiscout`, y si no es legible, su
 * edad. El cargo manda porque es una declaración explícita de SiScout; la edad
 * es una inferencia, y una inferencia no debe pisar un dato afirmado —- un
 * repitente o un adelantado están en la rama que dice su cargo, no en la que
 * les tocaría por años.
 */
function branchOf(person: SeedPerson): Branch | undefined {
  return (
    ramaDeEtiquetaSiscout(person.cargoSiscout) ?? branchFromAge(person.age)
  );
}

function classifyProtagonists(people: SeedPerson[]): Classification {
  const grouped = new Map<Branch, string[]>();
  const discarded: DiscardedPerson[] = [];

  for (const person of people) {
    if (person.tipo !== D.PERSON_TYPE.PROTAGONIST) continue;
    const branch = branchOf(person);
    if (!branch) {
      discarded.push({
        _id: person._id,
        name: person.name,
        cargoSiscout: person.cargoSiscout,
        age: person.age,
      });
      continue;
    }
    grouped.set(branch, [...(grouped.get(branch) ?? []), person._id]);
  }

  return { grouped, discarded };
}

/**
 * Las jefaturas de la rama entran a la unidad desde la siembra porque el bucket
 * `units_of_the_member` de PowerSync se parametriza por `unit_memberships`: un
 * subjefe sin fila propia no recibe en su dispositivo ni un solo protagonista.
 */
function assistantsOf(
  branch: Branch,
  adults: SeedPerson[],
  leader: LeaderCandidate,
): string[] {
  return leadersOfBranch(branch, adults)
    .filter((candidate) => candidate._id !== leader._id)
    .map((candidate) => candidate._id);
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
    (branch): PlannedUnit => {
      const leader = resolveUnitLeader(branch, adults)!;
      return {
        name: placeholderName(branch),
        branch,
        groupId,
        districtId: withDistrict?.districtId,
        districtName: withDistrict?.districtName,
        unitLeaderId: leader._id,
        leaders: assistantsOf(branch, adults, leader),
        members: grouped.get(branch)!,
      };
    },
  );

  return { units, discarded };
}
