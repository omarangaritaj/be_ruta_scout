import { ramaDeCargo } from '../catalogo-cargos/catalogo-cargos';
import { ramaDeEtiquetaSiscout, type Rama } from '../catalogo-cargos/ramas';
import type { NivelCargo } from '../users/schemas/cargo.subschema';
import type { NivelAcceso } from '../users/schemas/user.schema';

/**
 * Qué unidades le tocan a quien entra a `/unidades`.
 *
 * `jefatura-requerida` no es un error: es la respuesta legítima para quien
 * pertenece a un grupo pero cuyo cargo no dice sobre qué rama manda (un
 * colaborador de grupo, por ejemplo). Hay que preguntárselo.
 */
export type AlcanceUnidades =
  | { type: 'all' }
  | { type: 'grupo'; groupId: number }
  | { type: 'rama'; rama: Rama; groupId: number }
  | { type: 'jefatura-requerida'; groupId: number }
  | { type: 'sin-grupo' };

export interface PerfilParaAlcance {
  nivelAcceso?: NivelAcceso;
  groupId?: number;
  cargoSiscout?: string;
  cargos?: { nombreCargo: string; nivel: NivelCargo }[];
}

const NIVELES_SIN_FILTRO: NivelAcceso[] = ['super_admin', 'nacion', 'region'];

const CARGOS_DE_TODO_EL_GRUPO = ['JEFE DE GRUPO', 'SUBJEFE DE GRUPO'];

/**
 * Rama que la propia plataforma le asignó a la persona. Tiene prioridad sobre
 * lo que diga SiScout: `cargos` es decisión nuestra y el sync no lo toca.
 */
function ramaAsignada(perfil: PerfilParaAlcance): Rama | undefined {
  for (const cargo of perfil.cargos ?? []) {
    if (cargo.nivel !== 'rama') continue;
    const rama = ramaDeCargo(cargo.nombreCargo);
    if (rama) return rama;
  }
  return undefined;
}

/**
 * Rama según SiScout: primero como jefatura (`JEFE DE MANADA`) y si no, como
 * etiqueta de rama a secas, que es lo que trae un protagonista (`LOBATO`).
 */
function ramaSegunSiscout(perfil: PerfilParaAlcance): Rama | undefined {
  return (
    ramaDeCargo(perfil.cargoSiscout) ??
    ramaDeEtiquetaSiscout(perfil.cargoSiscout)
  );
}

export function resolverAlcance(perfil: PerfilParaAlcance): AlcanceUnidades {
  if (perfil.nivelAcceso && NIVELES_SIN_FILTRO.includes(perfil.nivelAcceso)) {
    return { type: 'all' };
  }

  const { groupId } = perfil;
  if (!groupId) return { type: 'sin-grupo' };

  const rama = ramaAsignada(perfil) ?? ramaSegunSiscout(perfil);
  if (rama) return { type: 'rama', rama, groupId };

  if (
    perfil.cargoSiscout &&
    CARGOS_DE_TODO_EL_GRUPO.includes(perfil.cargoSiscout)
  ) {
    return { type: 'grupo', groupId };
  }

  return { type: 'jefatura-requerida', groupId };
}
