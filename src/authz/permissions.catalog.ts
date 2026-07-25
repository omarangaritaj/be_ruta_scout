/** Comodín total: concede cualquier permiso (super_admin). */
export const ALL_PERMISSION = '*';

/** Dónde tiene efecto un permiso. */
export type PermissionSide = 'be' | 'fe' | 'ambos';

export interface PermissionDef {
  key: string;
  descripcion: string;
  lado: PermissionSide;
}

/**
 * Catálogo canónico de permisos, formato `recurso:accion`. Fuente de verdad que
 * consumen el guard del BE y el FE. `lado` documenta dónde aplica cada uno:
 * hay permisos solo del back, solo del front, y compartidos.
 */
export const PERMISSIONS: PermissionDef[] = [
  { key: 'role:read', descripcion: 'Ver roles', lado: 'ambos' },
  { key: 'role:create', descripcion: 'Crear roles', lado: 'ambos' },
  { key: 'role:update', descripcion: 'Editar roles', lado: 'ambos' },
  { key: 'role:delete', descripcion: 'Eliminar roles', lado: 'ambos' },

  { key: 'user:read', descripcion: 'Ver usuarios', lado: 'ambos' },
  {
    key: 'user:approve',
    descripcion: 'Gestionar el acceso de usuarios',
    lado: 'ambos',
  },

  {
    key: 'solicitud:read',
    descripcion: 'Ver solicitudes de acceso',
    lado: 'ambos',
  },
  {
    key: 'solicitud:approve',
    descripcion: 'Aprobar solicitudes',
    lado: 'ambos',
  },
  {
    key: 'solicitud:reject',
    descripcion: 'Rechazar solicitudes',
    lado: 'ambos',
  },

  { key: 'unidad:read', descripcion: 'Ver unidades', lado: 'ambos' },
  { key: 'unidad:create', descripcion: 'Crear unidades', lado: 'ambos' },
  { key: 'unidad:update', descripcion: 'Editar unidades', lado: 'ambos' },
  { key: 'unidad:delete', descripcion: 'Eliminar unidades', lado: 'ambos' },

  { key: 'grupo:read', descripcion: 'Ver grupos', lado: 'ambos' },
  { key: 'grupo:create', descripcion: 'Crear grupos', lado: 'ambos' },
  { key: 'grupo:update', descripcion: 'Editar grupos', lado: 'ambos' },
  { key: 'grupo:delete', descripcion: 'Eliminar grupos', lado: 'ambos' },

  {
    key: 'siscout:sync',
    descripcion: 'Ejecutar la sincronización con SiScout',
    lado: 'be',
  },
  {
    key: 'siscout:config',
    descripcion: 'Editar la configuración de SiScout',
    lado: 'ambos',
  },

  {
    key: 'tablero:nacional',
    descripcion: 'Ver el tablero nacional',
    lado: 'fe',
  },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
const PERMISSION_SET = new Set(PERMISSION_KEYS);

/** ¿`value` es un permiso válido: del catálogo, comodín total o de recurso? */
export function isValidPermission(value: string): boolean {
  if (value === ALL_PERMISSION) return true;
  if (PERMISSION_SET.has(value)) return true;
  const recursoWildcard = /^([a-z]+):\*$/.exec(value);
  if (recursoWildcard) {
    return PERMISSION_KEYS.some((k) => k.startsWith(`${recursoWildcard[1]}:`));
  }
  return false;
}

/** ¿El conjunto `owned` concede el permiso `required`? Respeta `*` y `recurso:*`. */
export function granting(
  owned: ReadonlySet<string>,
  required: string,
): boolean {
  if (owned.has(ALL_PERMISSION)) return true;
  if (owned.has(required)) return true;
  const [recurso] = required.split(':');
  return owned.has(`${recurso}:*`);
}
