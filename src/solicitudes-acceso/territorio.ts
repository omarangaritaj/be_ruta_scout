import type { NivelSolicitud } from '../catalogo-cargos/catalogo-cargos';
import { ramaDeEtiquetaSiscout } from '../catalogo-cargos/ramas';
import { D } from '../domain';
import { K, type MessageKey } from '../i18n';
import type { Rama } from './schemas/solicitud-acceso.schema';

export interface Territorio {
  rama?: Rama;
  groupId?: number;
  districtId?: number;
}

function ramaDeSnapshot(
  snapshot: Record<string, unknown> | null,
): Rama | undefined {
  return typeof snapshot?.unidad === 'string'
    ? ramaDeEtiquetaSiscout(snapshot.unidad)
    : undefined;
}

function entero(valor: unknown): number | undefined {
  return typeof valor === 'number' ? valor : undefined;
}

/**
 * Resuelve el territorio del nivel: primero desde el snapshot de SiScout y, si
 * no alcanza, con lo que envió el cliente (se confía en él, como en ruta).
 *
 * El fallo viaja como CLAVE del catálogo, no como texto: así la función sigue
 * siendo pura y quien la llama decide con qué excepción la envuelve.
 */
export function resolverTerritorio(
  nivel: NivelSolicitud,
  snapshot: Record<string, unknown> | null,
  cliente: Territorio,
): Territorio | { error: MessageKey } {
  if (nivel === D.ROLE_LEVEL.NACION) {
    return {};
  }

  const districtId = entero(snapshot?.district_id) ?? cliente.districtId;
  const groupId = entero(snapshot?.group_id) ?? cliente.groupId;
  const rama = ramaDeSnapshot(snapshot) ?? cliente.rama;

  if (nivel === D.ROLE_LEVEL.REGION) {
    if (!districtId) return { error: K.REQUESTS.MISSING_REGION };
    return { districtId };
  }

  if (nivel === D.ROLE_LEVEL.GRUPO) {
    if (!groupId) return { error: K.REQUESTS.MISSING_GROUP };
    return { groupId, districtId };
  }

  if (!groupId) return { error: K.REQUESTS.MISSING_GROUP };
  if (!rama) return { error: K.REQUESTS.MISSING_BRANCH };
  return { rama, groupId, districtId };
}
