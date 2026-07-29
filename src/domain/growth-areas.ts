// GENERADO por `pnpm domain:gen` desde domain-manifest.json. No editar a mano.

import type { Branch } from './branches';

export const GROWTH_AREAS = [
  'corporalidad',
  'creatividad',
  'caracter',
  'afectividad',
  'sociabilidad',
  'espiritualidad',
  'socioafectividad',
] as const;
export type GrowthArea = (typeof GROWTH_AREAS)[number];

export const GROWTH_AREA_MESSAGE_KEY = {
  corporalidad: 'GROWTH_AREA.CORPORALIDAD',
  creatividad: 'GROWTH_AREA.CREATIVIDAD',
  caracter: 'GROWTH_AREA.CARACTER',
  afectividad: 'GROWTH_AREA.AFECTIVIDAD',
  sociabilidad: 'GROWTH_AREA.SOCIABILIDAD',
  espiritualidad: 'GROWTH_AREA.ESPIRITUALIDAD',
  socioafectividad: 'GROWTH_AREA.SOCIOAFECTIVIDAD',
} as const;

export const BRANCH_GROWTH_AREAS: Record<Branch, readonly GrowthArea[]> = {
  familia: [
    'corporalidad',
    'creatividad',
    'caracter',
    'socioafectividad',
    'espiritualidad',
  ],
  manada: [
    'corporalidad',
    'creatividad',
    'caracter',
    'afectividad',
    'sociabilidad',
    'espiritualidad',
  ],
  tropa: [
    'corporalidad',
    'creatividad',
    'caracter',
    'afectividad',
    'sociabilidad',
    'espiritualidad',
  ],
  comunidad: [
    'corporalidad',
    'creatividad',
    'caracter',
    'afectividad',
    'sociabilidad',
    'espiritualidad',
  ],
  clan: [
    'corporalidad',
    'creatividad',
    'caracter',
    'afectividad',
    'sociabilidad',
    'espiritualidad',
  ],
} as const;

/** Áreas que aplican a una rama. Familia usa socioafectividad; el resto, las seis clásicas. */
export function growthAreasOf(branch: Branch): readonly GrowthArea[] {
  return BRANCH_GROWTH_AREAS[branch];
}
