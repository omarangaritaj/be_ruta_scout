import { ramaDeCargo } from '../../catalogo-cargos/catalogo-cargos';
import { D, type Branch } from '../../domain';

export interface LeaderCandidate {
  _id: string;
  name: string;
  cargoSiscout?: string;
  cargos?: { nombreCargo: string; nivel: string }[];
}

const GROUP_CHIEF_TITLES = ['JEFE DE GRUPO', 'SUBJEFE DE GRUPO'];
const COLLABORATOR = 'COLABORADOR';

const DIACRITICS = /\p{Diacritic}/gu;

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

function titlesOf(candidate: LeaderCandidate): string[] {
  const assigned = (candidate.cargos ?? [])
    .filter((c) => c.nivel === D.ROLE_LEVEL.RAMA)
    .map((c) => c.nombreCargo);
  return candidate.cargoSiscout
    ? [...assigned, candidate.cargoSiscout]
    : assigned;
}

function leadsBranch(candidate: LeaderCandidate, branch: Branch): boolean {
  return titlesOf(candidate).some((title) => ramaDeCargo(title) === branch);
}

function isDeputy(candidate: LeaderCandidate, branch: Branch): boolean {
  return titlesOf(candidate).some(
    (title) => ramaDeCargo(title) === branch && normalize(title).startsWith('SUB'),
  );
}

function byName(a: LeaderCandidate, b: LeaderCandidate): number {
  return a.name.localeCompare(b.name);
}

export function resolveUnitLeader(
  branch: Branch,
  adults: LeaderCandidate[],
): LeaderCandidate | undefined {
  const sorted = [...adults].sort(byName);

  const branchLeaders = sorted.filter((a) => leadsBranch(a, branch));
  const titular = branchLeaders.find((a) => !isDeputy(a, branch));
  if (titular) return titular;
  if (branchLeaders.length > 0) return branchLeaders[0];

  for (const title of GROUP_CHIEF_TITLES) {
    const found = sorted.find(
      (a) => a.cargoSiscout && normalize(a.cargoSiscout) === title,
    );
    if (found) return found;
  }

  const collaborator = sorted.find(
    (a) => a.cargoSiscout && normalize(a.cargoSiscout).includes(COLLABORATOR),
  );
  if (collaborator) return collaborator;

  return sorted[0];
}
