export const NIVELES_SOLICITUD = ['rama', 'grupo', 'region', 'nacion'] as const;
export type NivelSolicitud = (typeof NIVELES_SOLICITUD)[number];

export interface CargoCatalogo {
  cargo: string;
  etiqueta: string;
  nivel: NivelSolicitud;
}

/**
 * `cargo` es el string EXACTO de SiScout (MAYÚSCULAS) para casar con el snapshot.
 * TODO(dominio): faltan los cargos de nivel `rama` — los define el usuario.
 */
export const CARGOS: CargoCatalogo[] = [
  { cargo: 'JEFE DE FAMILIA', etiqueta: 'Jefe de Familia', nivel: 'grupo' },
  {
    cargo: 'SUB-JEFE DE FAMILIA',
    etiqueta: 'Sub-Jefe de Familia',
    nivel: 'grupo',
  },
  { cargo: 'JEFE DE MANADA', etiqueta: 'Jefe de Manada', nivel: 'grupo' },
  {
    cargo: 'SUB-JEFE DE MANADA',
    etiqueta: 'Sub-Jefe de Manada',
    nivel: 'grupo',
  },
  { cargo: 'JEFE DE TROPA', etiqueta: 'Jefe de Tropa', nivel: 'grupo' },
  { cargo: 'SUB-JEFE DE TROPA', etiqueta: 'Sub-Jefe de Tropa', nivel: 'grupo' },
  { cargo: 'JEFE DE COMUNIDAD', etiqueta: 'Jefe de Comunidad', nivel: 'grupo' },
  {
    cargo: 'SUB-JEFE DE COMUNIDAD',
    etiqueta: 'Sub-Jefe de Comunidad',
    nivel: 'grupo',
  },
  { cargo: 'JEFE DE CLAN', etiqueta: 'Jefe de Clan', nivel: 'grupo' },
  { cargo: 'SUB-JEFE DE CLAN', etiqueta: 'Sub-Jefe de Clan', nivel: 'grupo' },
  { cargo: 'JEFE DE GRUPO', etiqueta: 'Jefe de Grupo', nivel: 'grupo' },
  { cargo: 'SUBJEFE DE GRUPO', etiqueta: 'Subjefe de Grupo', nivel: 'grupo' },

  {
    cargo: 'JEFE SCOUT REGIONAL',
    etiqueta: 'Jefe Scout Regional',
    nivel: 'region',
  },
  { cargo: 'SUBJEFE REGIONAL', etiqueta: 'Subjefe Regional', nivel: 'region' },
  {
    cargo: 'COMISIONADO(A) REGIONAL PARA CACHORROS',
    etiqueta: 'Comisionado(a) Regional para Cachorros',
    nivel: 'region',
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL PARA LOBATOS',
    etiqueta: 'Comisionado(a) Regional para Lobatos',
    nivel: 'region',
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL PARA SCOUTS',
    etiqueta: 'Comisionado(a) Regional para Scouts',
    nivel: 'region',
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL PARA NOMADAS SCOUT',
    etiqueta: 'Comisionado(a) Regional para Nómadas Scout',
    nivel: 'region',
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL PARA ROVERS',
    etiqueta: 'Comisionado(a) Regional para Rovers',
    nivel: 'region',
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL SCOUTS POR LOS ODS',
    etiqueta: 'Comisionado(a) Regional Scouts por los ODS',
    nivel: 'region',
  },
  {
    cargo: 'COMISIONADO(A) REGIONAL DE PROGRAMA DE JÓVENES',
    etiqueta: 'Comisionado(a) Regional de Programa de Jóvenes',
    nivel: 'region',
  },

  {
    cargo: 'JEFE SCOUT NACIONAL',
    etiqueta: 'Jefe Scout Nacional',
    nivel: 'nacion',
  },
  {
    cargo: 'SUBJEFE SCOUT NACIONAL',
    etiqueta: 'Subjefe Scout Nacional',
    nivel: 'nacion',
  },
  {
    cargo: 'DELEGADO JEFE SCOUT NACIONAL',
    etiqueta: 'Delegado Jefe Scout Nacional',
    nivel: 'nacion',
  },
  {
    cargo: 'COMISIONADO(A) NACIONAL PARA CACHORROS',
    etiqueta: 'Comisionado(a) Nacional para Cachorros',
    nivel: 'nacion',
  },
  {
    cargo: 'COMISIONADO(A) NACIONAL PARA LOBATOS',
    etiqueta: 'Comisionado(a) Nacional para Lobatos',
    nivel: 'nacion',
  },
  {
    cargo: 'COMISIONADO(A) NACIONAL PARA SCOUTS',
    etiqueta: 'Comisionado(a) Nacional para Scouts',
    nivel: 'nacion',
  },
  {
    cargo: 'COMISIONADO(A) NACIONAL PARA NOMADAS SCOUT',
    etiqueta: 'Comisionado(a) Nacional para Nómadas Scout',
    nivel: 'nacion',
  },
  {
    cargo: 'COMISIONADO(A) NACIONAL PARA ROVERS',
    etiqueta: 'Comisionado(a) Nacional para Rovers',
    nivel: 'nacion',
  },
  {
    cargo: 'COMISIONADO(A) NACIONAL SCOUTS POR LOS ODS',
    etiqueta: 'Comisionado(a) Nacional Scouts por los ODS',
    nivel: 'nacion',
  },
  {
    cargo: 'MIEMBRO DIRECCION NACIONAL DE PROGRAMA DE JOVENES',
    etiqueta: 'Miembro Dirección Nacional de Programa de Jóvenes',
    nivel: 'nacion',
  },
  {
    cargo: 'DIRECTOR(A) NACIONAL DE PROGRAMA DE JÓVENES',
    etiqueta: 'Director(a) Nacional de Programa de Jóvenes',
    nivel: 'nacion',
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
