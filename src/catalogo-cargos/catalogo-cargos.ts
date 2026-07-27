import { D, ROLE_LEVELS, type RoleLevel } from '../domain';
import type { Rama } from './ramas';

export const NIVELES_SOLICITUD = ROLE_LEVELS;
export type NivelSolicitud = RoleLevel;

export interface CargoCatalogo {
  cargo: string;
  etiqueta: string;
  nivel: NivelSolicitud;
  /** Solo en los cargos de nivel `rama`: sobre qué rama manda quien lo ocupa. */
  rama?: Rama;
}

/** `cargo` es el string EXACTO de SiScout (MAYÚSCULAS) para casar con el snapshot. */
export const CARGOS: CargoCatalogo[] = [
  {
    cargo: 'JEFE DE FAMILIA',
    etiqueta: 'Jefe de Familia',
    nivel: D.ROLE_LEVEL.RAMA,
    rama: D.BRANCH.FAMILIA,
  },
  {
    cargo: 'SUB-JEFE DE FAMILIA',
    etiqueta: 'Sub-Jefe de Familia',
    nivel: D.ROLE_LEVEL.RAMA,
    rama: D.BRANCH.FAMILIA,
  },
  {
    cargo: 'JEFE DE MANADA',
    etiqueta: 'Jefe de Manada',
    nivel: D.ROLE_LEVEL.RAMA,
    rama: D.BRANCH.MANADA,
  },
  {
    cargo: 'SUB-JEFE DE MANADA',
    etiqueta: 'Sub-Jefe de Manada',
    nivel: D.ROLE_LEVEL.RAMA,
    rama: D.BRANCH.MANADA,
  },
  {
    cargo: 'JEFE DE TROPA',
    etiqueta: 'Jefe de Tropa',
    nivel: D.ROLE_LEVEL.RAMA,
    rama: D.BRANCH.TROPA,
  },
  {
    cargo: 'SUB-JEFE DE TROPA',
    etiqueta: 'Sub-Jefe de Tropa',
    nivel: D.ROLE_LEVEL.RAMA,
    rama: D.BRANCH.TROPA,
  },
  {
    cargo: 'JEFE DE COMUNIDAD',
    etiqueta: 'Jefe de Comunidad',
    nivel: D.ROLE_LEVEL.RAMA,
    rama: D.BRANCH.COMUNIDAD,
  },
  {
    cargo: 'SUB-JEFE DE COMUNIDAD',
    etiqueta: 'Sub-Jefe de Comunidad',
    nivel: D.ROLE_LEVEL.RAMA,
    rama: D.BRANCH.COMUNIDAD,
  },
  {
    cargo: 'JEFE DE CLAN',
    etiqueta: 'Jefe de Clan',
    nivel: D.ROLE_LEVEL.RAMA,
    rama: D.BRANCH.CLAN,
  },
  {
    cargo: 'SUB-JEFE DE CLAN',
    etiqueta: 'Sub-Jefe de Clan',
    nivel: D.ROLE_LEVEL.RAMA,
    rama: D.BRANCH.CLAN,
  },
  {
    cargo: 'JEFE DE GRUPO',
    etiqueta: 'Jefe de Grupo',
    nivel: D.ROLE_LEVEL.GRUPO,
  },
  {
    cargo: 'SUBJEFE DE GRUPO',
    etiqueta: 'Subjefe de Grupo',
    nivel: D.ROLE_LEVEL.GRUPO,
  },

  {
    cargo: 'JEFE SCOUT REGIONAL',
    etiqueta: 'Jefe Scout Regional',
    nivel: D.ROLE_LEVEL.REGION,
  },
  {
    cargo: 'SUBJEFE REGIONAL',
    etiqueta: 'Subjefe Regional',
    nivel: D.ROLE_LEVEL.REGION,
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL PARA CACHORROS',
    etiqueta: 'Comisionado(a) Regional para Cachorros',
    nivel: D.ROLE_LEVEL.REGION,
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL PARA LOBATOS',
    etiqueta: 'Comisionado(a) Regional para Lobatos',
    nivel: D.ROLE_LEVEL.REGION,
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL PARA SCOUTS',
    etiqueta: 'Comisionado(a) Regional para Scouts',
    nivel: D.ROLE_LEVEL.REGION,
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL PARA NOMADAS SCOUT',
    etiqueta: 'Comisionado(a) Regional para Nómadas Scout',
    nivel: D.ROLE_LEVEL.REGION,
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL PARA ROVERS',
    etiqueta: 'Comisionado(a) Regional para Rovers',
    nivel: D.ROLE_LEVEL.REGION,
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL SCOUTS POR LOS ODS',
    etiqueta: 'Comisionado(a) Regional Scouts por los ODS',
    nivel: D.ROLE_LEVEL.REGION,
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL DE PROGRAMA DE JÓVENES',
    etiqueta: 'Comisionado(a) Regional de Programa de Jóvenes',
    nivel: D.ROLE_LEVEL.REGION,
  },

  {
    cargo: 'JEFE SCOUT NACIONAL',
    etiqueta: 'Jefe Scout Nacional',
    nivel: D.ROLE_LEVEL.NACION,
  },
  {
    cargo: 'SUBJEFE SCOUT NACIONAL',
    etiqueta: 'Subjefe Scout Nacional',
    nivel: D.ROLE_LEVEL.NACION,
  },
  {
    cargo: 'DELEGADO JEFE SCOUT NACIONAL',
    etiqueta: 'Delegado Jefe Scout Nacional',
    nivel: D.ROLE_LEVEL.NACION,
  },
  {
    cargo: 'COMISIONADO(A) NACIONAL PARA CACHORROS',
    etiqueta: 'Comisionado(a) Nacional para Cachorros',
    nivel: D.ROLE_LEVEL.NACION,
  },
  {
    cargo: 'COMISIONADO(A) NACIONAL PARA LOBATOS',
    etiqueta: 'Comisionado(a) Nacional para Lobatos',
    nivel: D.ROLE_LEVEL.NACION,
  },
  {
    cargo: 'COMISIONADO(A) NACIONAL PARA SCOUTS',
    etiqueta: 'Comisionado(a) Nacional para Scouts',
    nivel: D.ROLE_LEVEL.NACION,
  },
  {
    cargo: 'COMISIONADO(A) NACIONAL PARA NOMADAS SCOUT',
    etiqueta: 'Comisionado(a) Nacional para Nómadas Scout',
    nivel: D.ROLE_LEVEL.NACION,
  },
  {
    cargo: 'COMISIONADO(A) NACIONAL PARA ROVERS',
    etiqueta: 'Comisionado(a) Nacional para Rovers',
    nivel: D.ROLE_LEVEL.NACION,
  },
  {
    cargo: 'COMISIONADO(A) NACIONAL SCOUTS POR LOS ODS',
    etiqueta: 'Comisionado(a) Nacional Scouts por los ODS',
    nivel: D.ROLE_LEVEL.NACION,
  },
  {
    cargo: 'MIEMBRO DIRECCION NACIONAL DE PROGRAMA DE JOVENES',
    etiqueta: 'Miembro Dirección Nacional de Programa de Jóvenes',
    nivel: D.ROLE_LEVEL.NACION,
  },
  {
    cargo: 'DIRECTOR(A) NACIONAL DE PROGRAMA DE JÓVENES',
    etiqueta: 'Director(a) Nacional de Programa de Jóvenes',
    nivel: D.ROLE_LEVEL.NACION,
  },
];

export function esNivelSolicitud(valor: unknown): valor is NivelSolicitud {
  return (
    typeof valor === 'string' &&
    (NIVELES_SOLICITUD as readonly string[]).includes(valor)
  );
}

export function cargosPorNivel(nivel: NivelSolicitud): CargoCatalogo[] {
  return CARGOS.filter((c) => c.nivel === nivel);
}

export function cargoEsValido(cargo: string, nivel: NivelSolicitud): boolean {
  return CARGOS.some((c) => c.cargo === cargo && c.nivel === nivel);
}

export function etiquetaCargo(cargo: string): string {
  return CARGOS.find((c) => c.cargo === cargo)?.etiqueta ?? cargo;
}

export function nivelDeCargo(
  cargo: string | null | undefined,
): NivelSolicitud | undefined {
  if (!cargo) return undefined;
  return CARGOS.find((c) => c.cargo === cargo)?.nivel;
}

/**
 * Rama que dirige quien ocupa el cargo. `undefined` cuando el cargo no manda
 * sobre una rama concreta: `JEFE DE GRUPO` las abarca todas, un comisionado
 * actúa sobre otro nivel y un colaborador no dirige ninguna. En esos casos la
 * rama hay que preguntársela a la persona.
 */
export function ramaDeCargo(
  cargo: string | null | undefined,
): Rama | undefined {
  if (!cargo) return undefined;
  return CARGOS.find((c) => c.cargo === cargo)?.rama;
}

/** Cargos de jefatura de rama, para ofrecerlos cuando el cargo no la determina. */
export function cargosDeJefaturaDeRama(): CargoCatalogo[] {
  return CARGOS.filter((c) => c.nivel === D.ROLE_LEVEL.RAMA);
}

/** Etiqueta legible por nivel solicitable, para UI y correos. */
export const ETIQUETA_NIVEL_SOLICITABLE: Record<NivelSolicitud, string> = {
  rama: 'Rama',
  grupo: 'Grupo',
  region: 'Región',
  nacion: 'Nación',
};
