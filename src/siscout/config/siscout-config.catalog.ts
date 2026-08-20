import type { RuntimeConfigGroupDefinition } from '../../runtime-config/runtime-config.types';

/** Nombre del grupo de SiScout dentro de `app_config`. */
export const SISCOUT_CONFIG_GROUP_KEY = 'siscout';

/**
 * Contrato TIPADO de la configuración que el backend consume por nombre.
 *
 * La configuración tiene dos audiencias. Estas claves son la primera: el
 * sincronizador y el planificador las leen con `config.get().writeChunkSize`, así
 * que viven en el tipo y añadir una siempre exigirá tocar código. La segunda
 * audiencia son las claves que solo se guardan y se muestran: esas entran sin
 * pasar por aquí.
 */
export interface SiscoutConfigValues {
  /** Zonas a descargar. `1` es Colombia entera. */
  zoneIds: number[];
  /** Tamaño de página de la descarga (parámetro `length` de DataTables). */
  pageLength: number;
  /** Techo de páginas por zona: capacidad = pageLength * maxPages. */
  maxPages: number;
  /** Mínimo esperado en la zona principal; por debajo se aborta la corrida. */
  minMainZoneRecords: number;
  /** Tamaño de los lotes de escritura en la base de datos. */
  writeChunkSize: number;
  /** Expresión cron de la sincronización programada. */
  syncCron: string;
  /** Interruptor de la sincronización programada. */
  syncEnabled: boolean;
}

/**
 * Catálogo del grupo `siscout`.
 *
 * Cada entrada trae sus LÍMITES junto al valor. Antes esos límites vivían en un
 * esquema de Zod dentro del backend, así que el panel no podía conocerlos y cada
 * clave nueva obligaba a programar su formulario y su validación. Aquí viajan
 * con el registro: el backend valida contra ellos y el frontend pinta el control
 * adecuado sin saber de antemano qué claves existen.
 *
 * Reutiliza el permiso `siscout:config` que ya gobierna este dominio: el
 * catálogo de permisos es generado (`pnpm domain:gen`) y no hacía falta
 * inventar uno nuevo.
 */
export const SISCOUT_CONFIG_GROUP: RuntimeConfigGroupDefinition = {
  group: SISCOUT_CONFIG_GROUP_KEY,
  label: 'SiScout',
  description: 'Ajustes de la descarga y la sincronización con SiScout',
  permission: 'siscout:config',
  entries: [
    {
      key: 'syncEnabled',
      type: 'boolean',
      value: false,
      label: 'Sincronización programada',
      description: 'Interruptor de la corrida automática.',
      sortOrder: 10,
    },
    {
      key: 'syncCron',
      type: 'cron',
      value: '0 3 * * *',
      label: 'Horario de la sincronización',
      description: 'Expresión cron. Por defecto, todos los días a las 3:00.',
      sortOrder: 20,
    },
    {
      key: 'zoneIds',
      type: 'number[]',
      value: [1],
      label: 'Zonas a descargar',
      description: 'Identificadores de zona. El 1 es Colombia entera.',
      constraints: { minItems: 1, min: 1, integer: true, unique: true },
      sortOrder: 30,
    },
    {
      key: 'pageLength',
      type: 'number',
      value: 4000,
      label: 'Tamaño de página',
      description: 'Registros por petición a SiScout.',
      constraints: { min: 1, max: 10000, integer: true },
      sortOrder: 40,
    },
    {
      key: 'maxPages',
      type: 'number',
      value: 3,
      label: 'Páginas máximas por zona',
      description:
        'La capacidad de una zona es este número por el tamaño de página.',
      constraints: { min: 1, max: 100, integer: true },
      sortOrder: 50,
    },
    {
      key: 'minMainZoneRecords',
      type: 'number',
      value: 1000,
      label: 'Mínimo de la zona principal',
      description:
        'Si la zona principal trae menos registros, la corrida se aborta.',
      constraints: { min: 0, integer: true },
      sortOrder: 60,
    },
    {
      key: 'writeChunkSize',
      type: 'number',
      value: 500,
      label: 'Tamaño del lote de escritura',
      description: 'Registros por lote al guardar en la base de datos.',
      constraints: { min: 1, max: 5000, integer: true },
      sortOrder: 70,
    },
  ],
};

/**
 * Valores por defecto derivados del catálogo. Se usan como respaldo mientras la
 * configuración no esté cargada, para que nadie lea `undefined`.
 */
export const SISCOUT_CONFIG_DEFAULTS = Object.fromEntries(
  SISCOUT_CONFIG_GROUP.entries.map((entrada) => [entrada.key, entrada.value]),
) as unknown as SiscoutConfigValues;
