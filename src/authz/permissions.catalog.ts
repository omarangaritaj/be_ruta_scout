import { PERMISSION_KEYS, type PermissionKey } from '../domain';

/** Comodín total: concede cualquier permiso (super_admin). */
export const ALL_PERMISSION = '*';

/** Dónde tiene efecto un permiso. */
export type PermissionSide = 'be' | 'fe' | 'ambos';

export interface PermissionDef {
  key: PermissionKey;
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

  { key: 'unit:read', descripcion: 'Ver unidades', lado: 'ambos' },
  { key: 'unit:create', descripcion: 'Crear unidades', lado: 'ambos' },
  { key: 'unit:update', descripcion: 'Editar unidades', lado: 'ambos' },
  { key: 'unit:delete', descripcion: 'Eliminar unidades', lado: 'ambos' },

  { key: 'grupo:read', descripcion: 'Ver grupos', lado: 'ambos' },
  { key: 'grupo:create', descripcion: 'Crear grupos', lado: 'ambos' },
  { key: 'grupo:update', descripcion: 'Editar grupos', lado: 'ambos' },
  { key: 'grupo:delete', descripcion: 'Eliminar grupos', lado: 'ambos' },

  {
    key: 'question:read',
    descripcion: 'Ver preguntas de diagnóstico',
    lado: 'ambos',
  },
  {
    key: 'question:create',
    descripcion: 'Crear preguntas de diagnóstico',
    lado: 'ambos',
  },
  {
    key: 'question:update',
    descripcion: 'Editar preguntas de diagnóstico',
    lado: 'ambos',
  },
  {
    key: 'question:delete',
    descripcion: 'Eliminar preguntas de diagnóstico',
    lado: 'ambos',
  },

  { key: 'cycle:read', descripcion: 'Ver ciclos', lado: 'ambos' },
  { key: 'cycle:create', descripcion: 'Crear ciclos', lado: 'ambos' },
  { key: 'cycle:update', descripcion: 'Editar ciclos', lado: 'ambos' },
  { key: 'cycle:delete', descripcion: 'Eliminar ciclos', lado: 'ambos' },

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
    key: 'siscout:credentials',
    descripcion: 'Gestionar el pool de credenciales de SiScout',
    lado: 'be',
  },

  {
    key: 'tablero:nacional',
    descripcion: 'Ver el tablero nacional',
    lado: 'fe',
  },
];

export { PERMISSION_KEYS };
const PERMISSION_SET = new Set<string>(PERMISSION_KEYS);

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
