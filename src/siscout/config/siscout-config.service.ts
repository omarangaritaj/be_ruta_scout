import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { UpdateSiscoutConfigDto } from './dto/update-siscout-config.dto';
import {
  SISCOUT_CONFIG_DEFAULTS,
  type SiscoutConfigValues,
} from './siscout-config.defaults';
import {
  SiscoutConfig,
  SiscoutConfigDocument,
} from './schemas/siscout-config.schema';

const SINGLETON_KEY = 'default';

type ChangeListener = (config: SiscoutConfigValues) => void;

/**
 * Configuración operativa de SiScout, cargada al arranque y cacheada en memoria.
 *
 * `get()` es SÍNCRONO y no toca la base: devuelve la copia en memoria, así que
 * cualquier parte de la aplicación puede leer la configuración vigente sin coste.
 * Cada actualización reescribe la caché y notifica a los suscriptores, de modo
 * que los cambios surten efecto en tiempo de ejecución sin reiniciar.
 */
@Injectable()
export class SiscoutConfigService implements OnModuleInit {
  private readonly logger = new Logger(SiscoutConfigService.name);
  private cached: SiscoutConfigValues = { ...SISCOUT_CONFIG_DEFAULTS };
  private loaded = false;
  private readonly listeners: ChangeListener[] = [];

  constructor(
    @InjectModel(SiscoutConfig.name)
    private readonly configModel: Model<SiscoutConfigDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureLoaded();
  }

  /**
   * Garantiza que la configuración esté cargada antes de usarla, sin depender
   * del orden en que NestJS inicializa los módulos.
   */
  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    // Inserta los valores por defecto la primera vez; en adelante solo lee.
    const document = await this.configModel
      .findOneAndUpdate(
        { key: SINGLETON_KEY },
        { $setOnInsert: { key: SINGLETON_KEY, ...SISCOUT_CONFIG_DEFAULTS } },
        { returnDocument: 'after', upsert: true },
      )
      .lean()
      .exec();

    this.cached = this.toValues(document);
    this.loaded = true;
    this.logger.log('Configuración de SiScout cargada');
  }

  /** Configuración vigente. Copia defensiva: nadie muta la caché por fuera. */
  get(): SiscoutConfigValues {
    return { ...this.cached, zoneIds: [...this.cached.zoneIds] };
  }

  async update(patch: UpdateSiscoutConfigDto): Promise<SiscoutConfigValues> {
    const document = await this.configModel
      .findOneAndUpdate(
        { key: SINGLETON_KEY },
        { $set: patch },
        { returnDocument: 'after', upsert: true },
      )
      .lean()
      .exec();

    this.cached = this.toValues(document);
    this.notify();
    this.logger.log(
      `Configuración actualizada: ${Object.keys(patch).join(', ')}`,
    );

    return this.get();
  }

  /** Restablece la configuración a los valores por defecto. */
  async reset(): Promise<SiscoutConfigValues> {
    const document = await this.configModel
      .findOneAndUpdate(
        { key: SINGLETON_KEY },
        { $set: { ...SISCOUT_CONFIG_DEFAULTS } },
        { returnDocument: 'after', upsert: true },
      )
      .lean()
      .exec();

    this.cached = this.toValues(document);
    this.notify();
    this.logger.log('Configuración restablecida a los valores por defecto');

    return this.get();
  }

  /** Registra un suscriptor que se ejecuta cuando la configuración cambia. */
  onChange(listener: ChangeListener): void {
    this.listeners.push(listener);
  }

  private notify(): void {
    const snapshot = this.get();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private toValues(document: SiscoutConfig | null): SiscoutConfigValues {
    const source = document ?? SISCOUT_CONFIG_DEFAULTS;
    return {
      zoneIds: source.zoneIds ?? SISCOUT_CONFIG_DEFAULTS.zoneIds,
      pageLength: source.pageLength,
      maxPages: source.maxPages,
      minMainZoneRecords: source.minMainZoneRecords,
      writeChunkSize: source.writeChunkSize,
      syncCron: source.syncCron,
      syncEnabled: source.syncEnabled,
    };
  }
}
