// GENERADO por `pnpm domain:gen` desde domain-manifest.json. No editar a mano.

export const BRANCHES = [
  'familia',
  'manada',
  'tropa',
  'comunidad',
  'clan',
] as const;
export type Branch = (typeof BRANCHES)[number];

export const BRANCH_SISCOUT_ALIASES: Record<string, Branch> = {
  FAMILIA: 'familia',
  CACHORRO: 'familia',
  CACHORROS: 'familia',
  MANADA: 'manada',
  LOBATO: 'manada',
  LOBATOS: 'manada',
  TROPA: 'tropa',
  SCOUT: 'tropa',
  SCOUTS: 'tropa',
  COMUNIDAD: 'comunidad',
  NOMADA: 'comunidad',
  'NOMADA SCOUT': 'comunidad',
  'NOMADAS SCOUT': 'comunidad',
  CLAN: 'clan',
  ROVER: 'clan',
  ROVERS: 'clan',
};

export interface BranchAgeRange {
  branch: Branch;
  min: number;
  max: number;
}

/** Tramos de edad de la progresión, contiguos y ambos extremos inclusive. */
export const BRANCH_AGE_RANGES: readonly BranchAgeRange[] = [
  { branch: 'familia', min: 0, max: 6 },
  { branch: 'manada', min: 7, max: 9 },
  { branch: 'tropa', min: 10, max: 14 },
  { branch: 'comunidad', min: 15, max: 17 },
  { branch: 'clan', min: 18, max: 21 },
] as const;

/**
 * Rama que corresponde a una edad. Es el RESPALDO de
 * `ramaDeEtiquetaSiscout`: SiScout guarda la rama en el campo `cargo` del
 * protagonista, pero se la pisa con el cargo de responsabilidad juvenil
 * (GUIA DE PATRULLA, PRESIDENTE DE CLAN…) en cuanto tiene uno. Sin este
 * respaldo, justo los protagonistas con más responsabilidad de su unidad son
 * los que se quedan sin ella.
 *
 * Fuera de rango devuelve `undefined`: por encima de 21 ya no hay
 * progresión que ofrecer, y adivinar una rama sería peor que reportarlo.
 */
export function branchFromAge(
  age: number | null | undefined,
): Branch | undefined {
  if (age == null || !Number.isInteger(age)) return undefined;
  return BRANCH_AGE_RANGES.find((r) => age >= r.min && age <= r.max)?.branch;
}

export const BRANCH_MESSAGE_KEY = {
  familia: 'BRANCH.FAMILIA',
  manada: 'BRANCH.MANADA',
  tropa: 'BRANCH.TROPA',
  comunidad: 'BRANCH.COMUNIDAD',
  clan: 'BRANCH.CLAN',
} as const;
