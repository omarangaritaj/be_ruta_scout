import { ramaDeCargo } from '../catalogo-cargos/catalogo-cargos';
import { ramaDeEtiquetaSiscout, type Rama } from '../catalogo-cargos/ramas';
import { D } from '../domain';
import type { NivelCargo } from '../users/schemas/cargo.subschema';
import type { NivelAcceso } from '../users/schemas/user.schema';

/**
 * Qué unidades le tocan a quien entra a `/units`.
 *
 * `leadership-required` no es un error: es la respuesta legítima para quien
 * pertenece a un grupo pero cuyo cargo no dice sobre qué rama manda (un
 * colaborador de grupo, por ejemplo). Hay que preguntárselo.
 *
 * Los `type` de abajo son discriminantes de esta unión, NO vocabulario del
 * manifiesto: nombran formas de esta respuesta, no valores que viajen como
 * dato. Por eso `'group'` y `'branch'` aquí no salen del diccionario.
 */
export type UnitScope =
  | { type: 'all' }
  | { type: 'group'; groupId: number }
  | { type: 'branch'; branch: Rama; groupId: number }
  | { type: 'leadership-required'; groupId: number }
  | { type: 'no-group' };

export interface ScopeProfile {
  nivelAcceso?: NivelAcceso;
  groupId?: number;
  cargoSiscout?: string;
  cargos?: { nombreCargo: string; nivel: NivelCargo }[];
}

const UNFILTERED_LEVELS: NivelAcceso[] = [
  D.ACCESS_LEVEL.SUPER_ADMIN,
  D.ACCESS_LEVEL.NACION,
  D.ACCESS_LEVEL.REGION,
];

const WHOLE_GROUP_TITLES = ['JEFE DE GRUPO', 'SUBJEFE DE GRUPO'];

/**
 * Rama que la propia plataforma le asignó a la persona. Tiene prioridad sobre
 * lo que diga SiScout: `cargos` es decisión nuestra y el sync no lo toca.
 */
function assignedBranch(profile: ScopeProfile): Rama | undefined {
  for (const cargo of profile.cargos ?? []) {
    if (cargo.nivel !== D.ROLE_LEVEL.RAMA) continue;
    const branch = ramaDeCargo(cargo.nombreCargo);
    if (branch) return branch;
  }
  return undefined;
}

/**
 * Rama según SiScout: primero como jefatura (`JEFE DE MANADA`) y si no, como
 * etiqueta de rama a secas, que es lo que trae un protagonista (`LOBATO`).
 */
function siscoutBranch(profile: ScopeProfile): Rama | undefined {
  return (
    ramaDeCargo(profile.cargoSiscout) ??
    ramaDeEtiquetaSiscout(profile.cargoSiscout)
  );
}

export function resolveUnitScope(profile: ScopeProfile): UnitScope {
  if (profile.nivelAcceso && UNFILTERED_LEVELS.includes(profile.nivelAcceso)) {
    return { type: 'all' };
  }

  const { groupId } = profile;
  if (!groupId) return { type: 'no-group' };

  const branch = assignedBranch(profile) ?? siscoutBranch(profile);
  if (branch) return { type: 'branch', branch, groupId };

  if (
    profile.cargoSiscout &&
    WHOLE_GROUP_TITLES.includes(profile.cargoSiscout)
  ) {
    return { type: 'group', groupId };
  }

  return { type: 'leadership-required', groupId };
}
