/** Respuesta cruda del endpoint DataTables `listar-miembros`. */
export interface MembersResponse {
  recordsTotal: number;
  recordsFiltered: number | null;
  data: unknown[];
}

/**
 * Lo MÍNIMO que hace falta para autenticarse: usuario, contraseña en claro y
 * la ruta que activa el perfil con el acceso necesario.
 *
 * El adaptador no conoce el pool de credenciales ni de dónde salieron estos
 * datos. Recibe un login y lo usa; quién lo eligió, por qué y con qué alcance
 * es asunto del motor de sincronización.
 */
export interface SiscoutLogin {
  usuario: string;
  password: string;
  changeRolPath: string;
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
  /**
   * Indica si la conexión al servicio externo está configurada.
   *
   * Solo comprueba la URL base: las credenciales ya no viven en el entorno,
   * sino en el pool, y de su disponibilidad responde `SiscoutCredentialsService`.
   */
  abstract isConfigured(): boolean;

  /**
   * Autentica con el login recibido y activa su perfil de acceso.
   * Devuelve el header `Cookie` de sesión que consumen las demás llamadas.
   */
  abstract authenticate(login: SiscoutLogin): Promise<string>;

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
