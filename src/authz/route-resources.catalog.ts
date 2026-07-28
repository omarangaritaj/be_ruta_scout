import { ROUTE_RESOURCES } from '../domain';

/** Comodín total: concede acceso a toda ruta del frontend (super_admin). */
export const ALL_ROUTE_RESOURCE = '*';

export const ROUTE_RESOURCE_PATHS: readonly string[] = ROUTE_RESOURCES.map(
  (resource) => resource.path,
);

export { ROUTE_RESOURCES };
const ROUTE_RESOURCE_SET = new Set<string>(ROUTE_RESOURCE_PATHS);

/**
 * ¿`value` es una ruta válida para `Role.resources`: del catálogo o el
 * comodín total? A diferencia de los permisos, no existe comodín por
 * recurso (`recurso:*`): las rutas no tienen esa forma jerárquica, son
 * paths exactos del catálogo.
 */
export function isValidRouteResource(value: string): boolean {
  if (value === ALL_ROUTE_RESOURCE) return true;
  return ROUTE_RESOURCE_SET.has(value);
}
