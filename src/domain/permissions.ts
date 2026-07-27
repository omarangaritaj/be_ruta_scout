// GENERADO por `pnpm domain:gen` desde domain-manifest.json. No editar a mano.

export const PERMISSION_KEYS = [
  'role:read',
  'role:create',
  'role:update',
  'role:delete',
  'user:read',
  'user:approve',
  'solicitud:read',
  'solicitud:approve',
  'solicitud:reject',
  'unit:read',
  'unit:create',
  'unit:update',
  'unit:delete',
  'grupo:read',
  'grupo:create',
  'grupo:update',
  'grupo:delete',
  'siscout:sync',
  'siscout:config',
  'siscout:credentials',
  'tablero:nacional',
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];
