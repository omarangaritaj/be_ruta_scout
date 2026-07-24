import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../../config';
import {
  SiscoutClient,
  type LoteSiscout,
  type RegistroSiscout,
} from '../ports/siscout-client.port';

/**
 * Adaptador HTTP contra SiScout.
 *
 * ⚠️ PENDIENTE DE AJUSTAR AL CONTRATO REAL. Todo lo específico del servicio
 * externo está confinado aquí: la forma de la petición, la autenticación y la
 * traducción de la respuesta. El motor de sincronización no cambia cuando esto
 * cambie, porque depende del puerto `SiscoutClient`, no de HTTP.
 *
 * Lo que hay que confirmar: esquema de paginación (offset/limit, página o
 * cursor), cabecera de autenticación y en qué propiedad viene el listado y el
 * identificador de cada registro.
 */
@Injectable()
export class SiscoutHttpClient extends SiscoutClient {
  private readonly logger = new Logger(SiscoutHttpClient.name);

  constructor(
    @Inject(ConfigService)
    private readonly config: AppConfigService,
  ) {
    super();
  }

  estaConfigurado(): boolean {
    return Boolean(this.config.get('SISCOUT_API_URL', { infer: true }));
  }

  async obtenerLote(offset: number, limite: number): Promise<LoteSiscout> {
    const base = this.config.get('SISCOUT_API_URL', { infer: true });
    const apiKey = this.config.get('SISCOUT_API_KEY', { infer: true });

    if (!base) {
      throw new Error('SISCOUT_API_URL no está configurada');
    }

    const url = new URL(base);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(limite));

    const respuesta = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    });

    if (!respuesta.ok) {
      throw new Error(
        `SiScout respondió ${respuesta.status} ${respuesta.statusText}`,
      );
    }

    const cuerpo: unknown = await respuesta.json();
    const registros = this.traducir(cuerpo);

    this.logger.debug(
      `Lote recibido: offset=${offset} registros=${registros.length}`,
    );

    return { registros, esUltimo: registros.length < limite };
  }

  /**
   * Traduce la respuesta cruda a registros del dominio.
   * ESTE es el punto a ajustar cuando se conozca el contrato real.
   */
  private traducir(cuerpo: unknown): RegistroSiscout[] {
    const lista = Array.isArray(cuerpo)
      ? cuerpo
      : ((cuerpo as { data?: unknown[] })?.data ?? []);

    return lista
      .filter(
        (elemento): elemento is Record<string, unknown> =>
          typeof elemento === 'object' && elemento !== null,
      )
      .map((elemento) => {
        const idSiscout = elemento.idSiscout ?? elemento.id;

        return {
          idSiscout: String(idSiscout),
          payload: elemento,
        };
      })
      .filter((registro) => registro.idSiscout !== 'undefined');
  }
}
