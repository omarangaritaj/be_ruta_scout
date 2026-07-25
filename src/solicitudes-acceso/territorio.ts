import type { NivelSolicitud } from '../catalogo-cargos/catalogo-cargos';
import type { Rama } from './schemas/solicitud-acceso.schema';

export interface Territorio {
  rama?: Rama;
  groupId?: number;
  districtId?: number;
}

const RAMA_POR_UNIDAD: Record<string, Rama> = {
  MANADA: 'manada',
  TROPA: 'tropa',
  COMUNIDAD: 'comunidad',
  CLAN: 'clan',
};

function ramaDeSnapshot(
  snapshot: Record<string, unknown> | null,
): Rama | undefined {
  const unidad =
    typeof snapshot?.unidad === 'string' ? snapshot.unidad.toUpperCase() : '';
  return RAMA_POR_UNIDAD[unidad];
}

function entero(valor: unknown): number | undefined {
  return typeof valor === 'number' ? valor : undefined;
}

/**
 * Resuelve el territorio del nivel: primero desde el snapshot de SiScout y, si
 * no alcanza, con lo que envió el cliente (se confía en él, como en ruta).
 */
export function resolverTerritorio(
  nivel: NivelSolicitud,
  snapshot: Record<string, unknown> | null,
  cliente: Territorio,
): Territorio | { error: string } {
  if (nivel === 'nacion') {
    return {};
  }

  const districtId = entero(snapshot?.district_id) ?? cliente.districtId;
  const groupId = entero(snapshot?.group_id) ?? cliente.groupId;
  const rama = ramaDeSnapshot(snapshot) ?? cliente.rama;

  if (nivel === 'region') {
    if (!districtId) return { error: 'Falta la región' };
    return { districtId };
  }

  if (nivel === 'grupo') {
    if (!groupId) return { error: 'Falta el grupo' };
    return { groupId, districtId };
  }

  if (!groupId) return { error: 'Falta el grupo' };
  if (!rama) return { error: 'Falta la rama' };
  return { rama, groupId, districtId };
}
