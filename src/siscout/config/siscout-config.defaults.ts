/**
 * Valores por defecto de la configuración operativa de SiScout.
 *
 * Antes vivían como valores por defecto de variables de entorno. Ahora son la
 * semilla del documento único de configuración: se insertan la primera vez que
 * arranca la aplicación y son también los valores a los que vuelve un `reset`.
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
  /** Tamaño de los lotes de escritura en Mongo. */
  writeChunkSize: number;
  /** Expresión cron de la sincronización programada. */
  syncCron: string;
  /** Interruptor de la sincronización programada. */
  syncEnabled: boolean;
}

export const SISCOUT_CONFIG_DEFAULTS: SiscoutConfigValues = {
  zoneIds: [1],
  pageLength: 4000,
  maxPages: 3,
  minMainZoneRecords: 1000,
  writeChunkSize: 500,
  syncCron: '0 3 * * *',
  syncEnabled: false,
};
