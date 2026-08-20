import type { PermissionKey } from '../domain';

/**
 * Lo que cabe en una columna `jsonb`.
 *
 * `unknown` sería más cómodo de escribir, pero TypeORM lo rechaza al construir
 * las consultas y, sobre todo, mentiría: en esa columna no cabe cualquier cosa,
 * cabe exactamente lo que JSON sabe representar.
 *
 * Se queda a un nivel de profundidad a propósito: la versión recursiva hace
 * estallar los genéricos de TypeORM con "type instantiation is excessively
 * deep". El interior de un objeto o un arreglo no se tipa, y no hace falta: lo
 * que valida la forma real de cada valor son las `constraints` del registro.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly unknown[]
  | Record<string, unknown>;

/**
 * Tipos que sabe manejar la configuración dinámica.
 *
 * No describen CÓMO se guarda el valor —de eso se encarga `jsonb`, que ya
 * conserva números, booleanos y arreglos en su forma nativa— sino QUÉ control
 * debe pintar el frontend y CÓMO hay que validar lo que llegue. Por eso la
 * lista incluye tipos semánticos como `cron`: por debajo es una cadena, pero ni
 * el control ni la validación se parecen a los de un texto libre.
 */
export const RUNTIME_CONFIG_TYPES = [
  'string',
  'number',
  'boolean',
  'number[]',
  'string[]',
  'cron',
  'select',
] as const;

export type RuntimeConfigType = (typeof RUNTIME_CONFIG_TYPES)[number];

/**
 * Reglas de validación que VIAJAN CON EL REGISTRO.
 *
 * Esta es la pieza que hace posible añadir configuraciones sin tocar código: si
 * los límites vivieran en un esquema estático del backend, cada clave nueva
 * exigiría programar su validación y el frontend tendría que aprenderse sus
 * rangos. Guardados aquí, el mismo objeto alimenta al validador del backend y
 * al control que pinta el frontend.
 */
export interface RuntimeConfigConstraints {
  /** Mínimo del número, o de cada elemento si el tipo es un arreglo. */
  min?: number;
  /** Máximo del número, o de cada elemento si el tipo es un arreglo. */
  max?: number;
  /** Exige número entero. `pageLength: 4000.5` no significa nada. */
  integer?: boolean;
  /** Mínimo de elementos del arreglo. */
  minItems?: number;
  /** Máximo de elementos del arreglo. */
  maxItems?: number;
  /** Expresión regular que debe cumplir la cadena. */
  pattern?: string;
  /** Opciones cerradas. Obligatorio cuando el tipo es `select`. */
  options?: { value: string | number; label: string }[];
  /** Elimina duplicados del arreglo antes de guardarlo. */
  unique?: boolean;
}

/** Una configuración del catálogo: su valor por defecto y cómo se presenta. */
export interface RuntimeConfigDefinition {
  key: string;
  type: RuntimeConfigType;
  /** Valor con el que nace y al que vuelve un `reset`. */
  value: JsonValue;
  label: string;
  description?: string;
  constraints?: RuntimeConfigConstraints;
  /** Orden de aparición en el panel. Menor va primero. */
  sortOrder?: number;
}

/**
 * Un grupo de configuración: el espacio de nombres que las agrupa en el panel y
 * el permiso que hay que tener para leerlas y editarlas.
 */
export interface RuntimeConfigGroupDefinition {
  group: string;
  label: string;
  description?: string;
  permission: PermissionKey;
  entries: RuntimeConfigDefinition[];
}

/** Una configuración tal como viaja al frontend: valor vigente + metadatos. */
export interface RuntimeConfigView {
  key: string;
  value: JsonValue;
  type: RuntimeConfigType;
  label: string;
  description: string | null;
  constraints: RuntimeConfigConstraints;
  isSystem: boolean;
}
