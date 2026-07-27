// GENERADO por `pnpm domain:gen` desde domain-manifest.json. No editar a mano.

export const ROLE_LEVELS = ['rama', 'grupo', 'region', 'nacion'] as const;
export type RoleLevel = (typeof ROLE_LEVELS)[number];

export const PERSON_TYPES = ['adulto', 'protagonista'] as const;
export type PersonType = (typeof PERSON_TYPES)[number];
