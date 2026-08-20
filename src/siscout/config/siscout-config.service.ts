import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  RuntimeConfigService,
  type RuntimeConfigValues,
} from '../../runtime-config/runtime-config.service';
import {
  SISCOUT_CONFIG_DEFAULTS,
  SISCOUT_CONFIG_GROUP_KEY,
  type SiscoutConfigValues,
} from './siscout-config.catalog';

type ChangeListener = (config: SiscoutConfigValues) => void;

/**
 * Vista TIPADA del grupo `siscout` de la configuración.
 *
 * Es una fachada delgada sobre `RuntimeConfigService`, y existe por una razón
 * concreta: el almacén dejó de tener columnas y pasó a tener registros, pero el
 * sincronizador y el planificador siguen leyendo `config.get().writeChunkSize`.
 * Esta clase absorbe el cambio de esquema para que esos consumidores no se
 * enteren. Por eso `get()` sigue siendo síncrono y `onChange()` conserva su
 * firma.
 */
@Injectable()
export class SiscoutConfigService implements OnModuleInit {
  constructor(private readonly appConfig: RuntimeConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureLoaded();
  }

  /** Garantiza la carga sin depender del orden de arranque de los módulos. */
  async ensureLoaded(): Promise<void> {
    await this.appConfig.ensureLoaded();
  }

  /**
   * Configuración vigente del grupo.
   *
   * El tipo es híbrido a propósito: las claves del catálogo conservan su tipo
   * fuerte —el sincronizador depende de eso— y las que se añadan en caliente
   * quedan accesibles como `unknown`, sin obligar a nadie a tocar el tipo para
   * que existan.
   *
   * Los valores por defecto van debajo como respaldo, para que una clave que
   * todavía no esté sembrada nunca se lea como `undefined`.
   */
  get(): SiscoutConfigValues & RuntimeConfigValues {
    return {
      ...SISCOUT_CONFIG_DEFAULTS,
      ...this.appConfig.getGroup(SISCOUT_CONFIG_GROUP_KEY),
    };
  }

  /** Registra un suscriptor que se ejecuta cuando la configuración cambia. */
  onChange(listener: ChangeListener): void {
    this.appConfig.onChange(SISCOUT_CONFIG_GROUP_KEY, () =>
      listener(this.get()),
    );
  }
}
