/**
 * Token de los grupos de configuración registrados.
 *
 * Los grupos los aporta cada módulo de dominio al ensamblar la aplicación, no
 * los conoce este módulo: `app-config` no debe importar de `siscout` ni de
 * ningún otro módulo, o la dependencia quedaría al revés.
 */
export const RUNTIME_CONFIG_GROUPS = Symbol('RUNTIME_CONFIG_GROUPS');
