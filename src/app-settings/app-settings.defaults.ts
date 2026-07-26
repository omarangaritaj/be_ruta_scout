/**
 * Valores por defecto de la configuración general de la aplicación.
 *
 * Son la semilla del documento único de la colección `app_config`: se insertan
 * la primera vez que arranca la aplicación y son los valores a los que vuelve un
 * `reset`. A diferencia de las variables de entorno, se editan en tiempo de
 * ejecución.
 */
export interface AppSettingsValues {
  /**
   * TTL por defecto (en segundos) de las entradas de cache que no especifican
   * uno propio. `0` o negativo significa sin expiración.
   */
  defaultCacheTtlSeconds: number;
}

export const APP_SETTINGS_DEFAULTS: AppSettingsValues = {
  defaultCacheTtlSeconds: 300,
};
