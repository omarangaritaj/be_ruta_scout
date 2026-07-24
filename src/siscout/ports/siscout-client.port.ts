/** Respuesta cruda del endpoint DataTables `listar-miembros`. */
export interface MembersResponse {
  recordsTotal: number;
  recordsFiltered: number | null;
  data: unknown[];
}

/**
 * Puerto del servicio externo.
 *
 * SiScout no expone una API REST: es una aplicación Laravel contra la que hay
 * que autenticarse por formulario y paginar mediante DataTables. Todo eso queda
 * confinado en el adaptador; el motor de sincronización solo conoce esta
 * interfaz, de modo que puede sustituirse por un doble en las pruebas.
 */
export abstract class SiscoutClient {
  /** Indica si las credenciales y la URL base están configuradas. */
  abstract isConfigured(): boolean;

  /**
   * Autentica y activa el rol con acceso nacional.
   * Devuelve el header `Cookie` de sesión que consumen las demás llamadas.
   */
  abstract authenticate(): Promise<string>;

  /**
   * Una página de miembros de una zona.
   * `draw` debe incrementarse en cada petición: DataTables lo usa para
   * descartar respuestas cacheadas.
   */
  abstract listZoneMembers(
    cookie: string,
    zoneId: number,
    start: number,
    length: number,
    draw: number,
  ): Promise<MembersResponse>;
}
