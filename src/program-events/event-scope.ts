import { levelRank } from '../authz/access-levels';
import { D } from '../domain';
import type { AccessLevel, ProgramEventKind } from '../domain';

/**
 * El alcance de un evento reutiliza los niveles de acceso del dominio: una
 * reunión es de rama, un campamento puede ser de grupo, y así. `super_admin`
 * queda fuera porque no describe un ámbito de actividad, solo un privilegio.
 */
export type EventScope = Extract<
  AccessLevel,
  'rama' | 'grupo' | 'region' | 'nacion'
>;

/** Regla 10: una reunión de ciclo siempre es de rama. */
export function isScopeCoherent(
  kind: ProgramEventKind,
  scope: EventScope,
): boolean {
  return kind === 'reunion' ? scope === D.ACCESS_LEVEL.RAMA : true;
}

/**
 * Regla 11: nadie planea por encima de su nivel. Se apoya en `levelRank`, que
 * ya modela la jerarquía y ya tiene sus pruebas; duplicar ese orden aquí sería
 * crear una segunda fuente de verdad para lo mismo.
 */
export function canUseScope(
  actorLevel: AccessLevel | undefined,
  scope: EventScope,
): boolean {
  const rank = levelRank(actorLevel);
  return rank >= 0 && rank >= levelRank(scope);
}
