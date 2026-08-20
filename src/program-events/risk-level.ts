export type RiskScore = 1 | 2 | 3 | 4 | 5;
export type RiskRating = 'bajo' | 'medio' | 'alto' | 'critico';

/**
 * Nivel de riesgo: probabilidad por consecuencia, ambas de 1 a 5. No se
 * persiste —se deriva al mostrarlo—, igual que el estado del ciclo sale de
 * `activatedAt` y `endDate` en vez de guardarse en una columna.
 *
 * Los umbrales vienen del prototipo `entorno-programa` (`riskCal`).
 */
export function riskLevel(
  probability: RiskScore,
  consequence: RiskScore,
): number {
  return probability * consequence;
}

export function riskRating(level: number): RiskRating {
  if (level <= 5) return 'bajo';
  if (level <= 10) return 'medio';
  if (level <= 15) return 'alto';
  return 'critico';
}
