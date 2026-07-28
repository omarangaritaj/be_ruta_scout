import { ACCESS_LEVELS, type AccessLevel } from '../domain';

/**
 * La otra cara de "nadie concede lo que no tiene": el `nivelAcceso` también es
 * privilegio. `region`, `nacion` y `super_admin` abren TODAS las unidades del
 * país (`unit-scope.ts`), así que conceder uno de esos niveles hay que
 * compararlo contra el nivel de quien lo concede. Módulo puro; de dónde sale el
 * nivel del actor lo resuelve `EscalationService`.
 */

/**
 * Rango jerárquico de un nivel: su POSICIÓN en `ACCESS_LEVELS`, que es donde
 * vive la jerarquía (el manifiesto no tiene un campo `order`). Quien no tiene
 * nivel queda por debajo de todos, y por eso no puede conceder ninguno.
 * `access-levels.spec.ts` fija el orden esperado para que reordenar el arreglo
 * salga en rojo en vez de mover privilegios en silencio.
 */
export function levelRank(level: AccessLevel | undefined): number {
  return level === undefined ? -1 : ACCESS_LEVELS.indexOf(level);
}

/** ¿El actor puede conceder ese nivel? Solo el suyo o uno por debajo. */
export function canGrantLevel(
  actor: AccessLevel | undefined,
  requested: AccessLevel,
): boolean {
  const rank = levelRank(actor);
  return rank >= 0 && rank >= levelRank(requested);
}
