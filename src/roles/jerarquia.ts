/**
 * Jerarquía de roles: quién es dueño de qué.
 *
 * Es la OTRA pregunta, distinta de la que responde `escalation.ts`. Aquella
 * responde "¿puedo respaldar este poder?" comparando conjuntos de permisos;
 * esta responde "¿este rol es mío para gestionarlo?". Un rol creado por un par
 * de otra área puede tener permisos que yo contengo, y aun así no ser mío.
 *
 * Las dos se aplican JUNTAS: la contención impide la escalada de privilegios,
 * la jerarquía delimita la custodia. Quitar cualquiera de las dos abre un
 * agujero distinto.
 *
 * Módulo puro; de dónde salen los roles del actor lo resuelve el servicio.
 */

/** Lo mínimo que hace falta de un rol para situarlo en el árbol. */
export interface NodoRol {
  id: string;
  /** Ancestros desde la raíz hasta el padre. Vacío en la raíz. */
  ancestros: readonly string[];
}

/** Un padre para colgar de él, o `null` para crear una raíz. */
export interface PadreRol {
  id: string;
  nivel: number;
  ancestros: readonly string[];
}

/**
 * Profundidad del hijo. La raíz es 0 y cada generación suma uno, así que el
 * `nivel` siempre coincide con `ancestros.length` — se guarda igual porque
 * ordenar y pintar el árbol por una columna entera es mucho más barato que
 * contar un arreglo en cada fila.
 */
export function nivelDeHijo(padre: PadreRol | null): number {
  return padre === null ? 0 : padre.nivel + 1;
}

/**
 * Linaje del hijo: el del padre más el padre mismo, de la raíz hacia abajo.
 *
 * Se materializa el camino en vez de recorrer `parentId` en cada consulta
 * porque la pregunta "¿está en mi subárbol?" se hace en CADA asignación y en
 * CADA edición. Con el camino guardado es mirar un arreglo; con punteros sería
 * un CTE recursivo cada vez. Se puede materializar porque el padre es
 * INMUTABLE: un rol no se recuelga, así que este arreglo nunca queda viejo.
 */
export function ancestrosDeHijo(padre: PadreRol | null): string[] {
  return padre === null ? [] : [...padre.ancestros, padre.id];
}

/**
 * ¿El rol cae dentro del subárbol de alguno de esos roles raíz?
 *
 * Incluye al propio rol raíz a propósito: "debajo mío o IGUAL al mío". Quien
 * tiene un rol puede concederlo — no está dando nada que no tenga.
 */
export function enSubarbolDe(rol: NodoRol, raices: readonly string[]): boolean {
  if (raices.length === 0) return false;
  const propias = new Set(raices);
  return propias.has(rol.id) || rol.ancestros.some((id) => propias.has(id));
}

/**
 * ¿Se puede colgar un rol nuevo de ese padre?
 *
 * El padre tiene que estar en el SUBÁRBOL del actor: sus propios roles o
 * cualquier descendiente de ellos. Exigir que fuera un rol que el actor TIENE
 * dejaría al árbol sin poder crecer — el super admin solo podría crear hijos
 * directos suyos, y para bajar un nivel más tendría que auto-asignarse cada rol
 * que crea.
 *
 * Permitir todo el subárbol no debilita nada: lo que cuelga de mí ya es mío
 * para editar y borrar, y los permisos del rol nuevo siguen acotados por los
 * míos (`assertCanGrant`). Lo que sigue prohibido es colgar de un rol ajeno o
 * del rol de mi jefe, que es donde estaría la escalada.
 */
export function puedeColgarDe(
  padre: NodoRol,
  rolesDelActor: readonly string[],
): boolean {
  return enSubarbolDe(padre, rolesDelActor);
}

/**
 * ¿Se puede recolgar `rol` bajo `nuevoPadre` sin romper el árbol?
 *
 * Prohibido colgarlo de sí mismo o de uno de sus descendientes: eso crearía un
 * ciclo y el linaje dejaría de tener raíz — `ancestros` se volvería infinito y
 * ninguna consulta de subárbol terminaría.
 */
export function creaCiclo(rol: NodoRol, nuevoPadre: NodoRol): boolean {
  return nuevoPadre.id === rol.id || nuevoPadre.ancestros.includes(rol.id);
}

/**
 * El linaje que le queda a un descendiente cuando su ancestro se recuelga.
 *
 * El camino materializado se paga aquí: mover un rol obliga a reescribir el
 * `ancestros` y el `nivel` de TODA su descendencia. Es el precio de que la
 * pregunta "¿está en mi subárbol?" —que se hace en cada asignación y cada
 * edición— sea mirar un arreglo en vez de un CTE recursivo. Mover es raro;
 * preguntar, constante.
 *
 * La reescritura es un cambio de prefijo: el descendiente guarda
 * `[...linajeViejoDelMovido, movido, ...resto]`, y solo cambia la primera
 * parte. `resto` (de `movido` hacia abajo) no se toca.
 */
export function relinajar(
  descendiente: NodoRol,
  largoLinajeAnterior: number,
  linajeNuevoDelMovido: readonly string[],
): string[] {
  return [
    ...linajeNuevoDelMovido,
    ...descendiente.ancestros.slice(largoLinajeAnterior),
  ];
}
