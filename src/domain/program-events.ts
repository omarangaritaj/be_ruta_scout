// GENERADO por `pnpm domain:gen` desde domain-manifest.json. No editar a mano.

export const PROGRAM_EVENT_KINDS = ['reunion', 'actividad'] as const;
export type ProgramEventKind = (typeof PROGRAM_EVENT_KINDS)[number];
export const RISK_TYPES = [
  'financiero',
  'fisico',
  'mecanico',
  'organizacional',
  'proteccion_infantil',
  'psicosocial',
  'reputacional',
] as const;
export type RiskType = (typeof RISK_TYPES)[number];
