/**
 * Reglas de fecha de un evento de programa. Todo se compara a medianoche UTC
 * para que el último día cuente completo, igual que `cycle-dates.ts`.
 */

function atMidnight(value: Date): number {
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}

/** Regla 1: una reunión ocupa un solo día. */
export function isSingleDay(startDate: Date, endDate: Date): boolean {
  return atMidnight(startDate) === atMidnight(endDate);
}

/** Regla 2: el evento cabe entero dentro del ciclo, extremos incluidos. */
export function isWithinCycle(
  startDate: Date,
  endDate: Date,
  cycleStart: Date,
  cycleEnd: Date,
): boolean {
  return (
    atMidnight(startDate) >= atMidnight(cycleStart) &&
    atMidnight(endDate) <= atMidnight(cycleEnd)
  );
}

/**
 * Regla 4: ¿dos eventos comparten al menos un día? Los rangos son cerrados en
 * ambos extremos, así que compartir solo el día del borde ya es solape.
 */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return (
    atMidnight(aStart) <= atMidnight(bEnd) &&
    atMidnight(bStart) <= atMidnight(aEnd)
  );
}

/**
 * Lleva una fecha a medianoche UTC. Las columnas `startDate` y `endDate` se
 * persisten así siempre: la hora del evento vive en `startTime`/`endTime`, y
 * el índice único que impide dos reuniones de la misma unidad el mismo día
 * compara el valor tal cual — con una hora dentro, dos reuniones del mismo día
 * serían dos valores distintos y el índice las dejaría pasar.
 */
export function toMidnightUTC(value: Date): Date {
  return new Date(atMidnight(value));
}

/**
 * Regla 6: un momento de la agenda cae dentro del rango del evento. Recibe la
 * fecha como cadena ISO porque así viaja dentro del `jsonb` de la agenda; una
 * cadena inválida es un día fuera de rango, no una excepción.
 */
export function isDayWithin(
  day: string,
  startDate: Date,
  endDate: Date,
): boolean {
  const fecha = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) return false;
  // `new Date` no rechaza un día imposible: lo hace rodar al mes siguiente,
  // así que '2026-02-30' se convertiría en el 2 de marzo y entraría como
  // válido. Comparar la fecha ya normalizada contra la cadena original
  // descarta esos casos: si no coinciden, el día no existía.
  if (fecha.toISOString().slice(0, 10) !== day) return false;
  return isWithinCycle(fecha, fecha, startDate, endDate);
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Regla 7: cuántos días completos separan dos fechas, a medianoche UTC — el
 * delta que `reschedule` aplica a cada momento de la agenda cuando el evento
 * se mueve. Puede ser negativo (mover hacia atrás) o cero (cambiar solo la
 * duración, sin mover el inicio).
 */
export function diffInDays(before: Date, after: Date): number {
  return Math.round((atMidnight(after) - atMidnight(before)) / MS_POR_DIA);
}

/**
 * Regla 7: desplaza un día ISO `deltaDias` días. Mueve una reunión del 22 al
 * 29 (delta +7) y su momento del 22 pasa al 29 — es lo que cualquiera espera
 * al arrastrar una reunión a otra fecha, no una reasignación que el
 * dirigente tenga que hacer a mano. Un día que no parsea (dato legado o
 * corrupto) se devuelve tal cual: `isDayWithin`, que corre después sobre el
 * resultado, ya lo rechaza como inválido — no hace falta duplicar esa
 * validación aquí.
 */
export function shiftDay(day: string, deltaDias: number): string {
  const fecha = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) return day;
  fecha.setUTCDate(fecha.getUTCDate() + deltaDias);
  return fecha.toISOString().slice(0, 10);
}
