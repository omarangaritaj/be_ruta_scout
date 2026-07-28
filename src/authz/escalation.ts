import { granting } from './permissions.catalog';

/**
 * No escalada de privilegios: nadie concede lo que no tiene. Este módulo es
 * puro; quién puede conceder qué lo resuelve `EscalationService`.
 */

/**
 * Lo que `next` añade respecto de `previous`. Solo se valida lo que se concede:
 * bloquear también las bajas impediría a un admin revocarle algo a alguien más
 * poderoso que él, y quitar nunca escala privilegios.
 */
export function addedValues(
  previous: readonly string[] | undefined,
  next: readonly string[],
): string[] {
  const before = new Set(previous ?? []);
  return [...new Set(next.filter((value) => !before.has(value)))];
}

/**
 * De `requested`, lo que `owned` NO concede. Se compara con `granting` y no con
 * `includes` porque los comodines no son simétricos: `unit:*` concede
 * `unit:read`, pero `unit:read` no concede `unit:*` ni `*` (otorgar un comodín
 * es otorgar más de lo que se tiene).
 */
export function ungrantable(
  owned: ReadonlySet<string>,
  requested: readonly string[],
): string[] {
  return [...new Set(requested.filter((value) => !granting(owned, value)))];
}
