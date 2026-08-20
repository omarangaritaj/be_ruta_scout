/**
 * Respuesta a una pregunta cerrada del formulario. `null` significa que aún no
 * se responde: los controles del formulario oficial nacen sin selección, así
 * que «respondió que no» y «todavía no respondió» son estados distintos.
 *
 * Estos predicados existen porque `false` y `null` son ambos falsy: en el
 * bloque de A Salvo del Peligro, `if (!respuesta)` colapsaría «no hay botón de
 * emergencia» con «nadie contestó». Se compara siempre de forma explícita.
 */
export type Answer = boolean | null;

export function isYes(value: Answer): boolean {
  return value === true;
}

export function isNo(value: Answer): boolean {
  return value === false;
}

export function isUnanswered(value: Answer): boolean {
  return value === null;
}

/** ¿Todas respondidas? `false` cuenta como respuesta; solo `null` falta. */
export function allAnswered(values: Answer[]): boolean {
  return values.every((value) => !isUnanswered(value));
}
