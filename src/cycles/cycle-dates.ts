export function hasValidRange(startDate: Date, endDate: Date): boolean {
  return endDate.getTime() > startDate.getTime();
}

/**
 * ¿El ciclo ya terminó? Compara a medianoche UTC para que el último día cuente
 * completo, igual que el cálculo de estado del frontend.
 */
export function hasEnded(endDate: Date, today: Date): boolean {
  return atMidnight(today) > atMidnight(endDate);
}

function atMidnight(value: Date): number {
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}
