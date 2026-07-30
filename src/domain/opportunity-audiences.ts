// GENERADO por `pnpm domain:gen` desde domain-manifest.json. No editar a mano.

export const OPPORTUNITY_AUDIENCES = [
  'unidad_completa',
  'subgrupo',
  'protagonistas_especificos',
] as const;
export type OpportunityAudience = (typeof OPPORTUNITY_AUDIENCES)[number];

export const OPPORTUNITY_AUDIENCE_MESSAGE_KEY = {
  unidad_completa: 'OPPORTUNITY_AUDIENCE.UNIT',
  subgrupo: 'OPPORTUNITY_AUDIENCE.SUBGROUP',
  protagonistas_especificos: 'OPPORTUNITY_AUDIENCE.SPECIFIC_MEMBERS',
} as const;
