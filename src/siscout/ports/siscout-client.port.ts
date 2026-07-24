/** Un registro tal y como lo devuelve SiScout. */
export interface RegistroSiscout {
  /** Identificador del registro en SiScout: correlaciona con `users.idSiscout`. */
  idSiscout: string;
  /** Resto de la información externa, sin interpretar. */
  payload: Record<string, unknown>;
}

export interface LoteSiscout {
  registros: RegistroSiscout[];
  /** `true` cuando ya no quedan más páginas por recorrer. */
  esUltimo: boolean;
}

/**
 * Puerto del servicio externo.
 *
 * El motor de sincronización depende de esta interfaz, no de HTTP. Así el
 * contrato concreto (URL, autenticación, forma de la paginación) queda
 * confinado al adaptador y se puede sustituir por un doble en las pruebas.
 */
export abstract class SiscoutClient {
  /** Indica si el cliente está configurado y puede usarse. */
  abstract estaConfigurado(): boolean;

  /** Devuelve un lote de registros a partir de un desplazamiento. */
  abstract obtenerLote(offset: number, limite: number): Promise<LoteSiscout>;
}
