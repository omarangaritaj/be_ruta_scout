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
