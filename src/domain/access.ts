// GENERADO por `pnpm domain:gen` desde domain-manifest.json. No editar a mano.

export const ACCESS_STATES = [
  'sin_solicitud',
  'pendiente',
  'aprobado',
  'rechazado',
  'suspendido',
] as const;
export type AccessState = (typeof ACCESS_STATES)[number];

export const ACCESS_LEVELS = [
  'rama',
  'grupo',
  'region',
  'nacion',
  'super_admin',
] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const REQUEST_STATES = [
  'pendiente',
  'en_revision',
  'aprobada',
  'rechazada',
  'cancelada',
] as const;
export type RequestState = (typeof REQUEST_STATES)[number];
