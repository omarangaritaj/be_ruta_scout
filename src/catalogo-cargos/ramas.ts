import { BRANCHES, BRANCH_SISCOUT_ALIASES, type Branch } from '../domain';

export const RAMAS = BRANCHES;
export type Rama = Branch;

const DIACRITICOS = /\p{Diacritic}/gu;

const normalizar = (valor: string): string =>
  valor
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

export function esRama(valor: unknown): valor is Rama {
  return (
    typeof valor === 'string' && (RAMAS as readonly string[]).includes(valor)
  );
}

/**
 * Rama a partir de una etiqueta de SiScout, sea nombre de unidad (`MANADA`) o
 * de rama (`LOBATO`). La comparación es exacta contra el catálogo de alias, no
 * por subcadena: `COMISIONADO(A) NACIONAL PARA LOBATOS` NO dirige una manada.
 */
export function ramaDeEtiquetaSiscout(
  etiqueta: string | null | undefined,
): Rama | undefined {
  if (!etiqueta) return undefined;
  return BRANCH_SISCOUT_ALIASES[normalizar(etiqueta)];
}
