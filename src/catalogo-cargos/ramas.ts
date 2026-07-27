export const RAMAS = [
  'familia',
  'manada',
  'tropa',
  'comunidad',
  'clan',
] as const;
export type Rama = (typeof RAMAS)[number];

export const ETIQUETA_RAMA: Record<Rama, string> = {
  familia: 'Familia',
  manada: 'Manada',
  tropa: 'Tropa',
  comunidad: 'Comunidad',
  clan: 'Clan',
};

/**
 * SiScout nombra la misma rama de dos formas según el tipo de persona: en un
 * adulto llega el nombre de la UNIDAD (`snapshot.unidad` → MANADA) y en un
 * protagonista llega el nombre de la RAMA en `cargoSiscout` (LOBATO). Ambos
 * alias apuntan a la misma rama, así que conviven en un único mapa.
 */
const RAMA_POR_ALIAS: Record<string, Rama> = {
  FAMILIA: 'familia',
  CACHORRO: 'familia',
  CACHORROS: 'familia',
  MANADA: 'manada',
  LOBATO: 'manada',
  LOBATOS: 'manada',
  TROPA: 'tropa',
  SCOUT: 'tropa',
  SCOUTS: 'tropa',
  COMUNIDAD: 'comunidad',
  NOMADA: 'comunidad',
  'NOMADA SCOUT': 'comunidad',
  'NOMADAS SCOUT': 'comunidad',
  CLAN: 'clan',
  ROVER: 'clan',
  ROVERS: 'clan',
};

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
  return RAMA_POR_ALIAS[normalizar(etiqueta)];
}
