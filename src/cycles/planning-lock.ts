/**
 * ¿El ciclo dejó de admitir cambios en su planeación? Basta con que esté
 * activado: sus oportunidades se consultan pero no se crean, editan ni
 * seleccionan. Para volver a tocarlas hay que devolverlo a borrador.
 *
 * Un ciclo vencido que nunca se activó sigue siendo borrador y se puede editar:
 * lo que cierra la planeación es la activación, no el calendario.
 */
export function isPlanningLocked(cycle: {
  activatedAt?: Date | null;
}): boolean {
  return Boolean(cycle.activatedAt);
}
