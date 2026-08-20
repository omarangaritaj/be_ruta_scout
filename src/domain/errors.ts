// GENERADO por `pnpm domain:gen` desde domain-manifest.json. No editar a mano.

export const API_ERROR_CODES = [
  'UNITS.LEADERSHIP_REQUIRED',
  'UNITS.MISSING_GROUP',
  'EVENTS.OUTSIDE_CYCLE',
  'EVENTS.DATE_TAKEN',
  'VALIDATION.INVALID_INPUT',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
