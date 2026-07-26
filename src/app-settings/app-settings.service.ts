import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  APP_SETTINGS_DEFAULTS,
  type AppSettingsValues,
} from './app-settings.defaults';
import {
  AppSettings,
  AppSettingsDocument,
} from './schemas/app-settings.schema';

const SINGLETON_KEY = 'default';

type ChangeListener = (settings: AppSettingsValues) => void;

/**
 * Configuración general de la aplicación, cargada al arranque y cacheada en
 * memoria.
 *
 * `get()` es SÍNCRONO y no toca la base: devuelve la copia en memoria, así que
 * cualquier parte de la aplicación (p. ej. el cache de Redis para resolver el
 * TTL por defecto) puede leer la configuración vigente sin coste. Cada
 * actualización reescribe la caché y notifica a los suscriptores, de modo que
 * los cambios surten efecto en tiempo de ejecución sin reiniciar.
 */
@Injectable()
export class AppSettingsService implements OnModuleInit {
  private readonly logger = new Logger(AppSettingsService.name);
  private cached: AppSettingsValues = { ...APP_SETTINGS_DEFAULTS };
  private loaded = false;
  private readonly listeners: ChangeListener[] = [];

  constructor(
    @InjectModel(AppSettings.name)
    private readonly model: Model<AppSettingsDocument>,
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
    const document = await this.model
      .findOneAndUpdate(
        { key: SINGLETON_KEY },
        { $setOnInsert: { key: SINGLETON_KEY, ...APP_SETTINGS_DEFAULTS } },
        { returnDocument: 'after', upsert: true },
      )
      .lean()
      .exec();

    this.cached = this.toValues(document);
    this.loaded = true;
    this.logger.log('Configuración de la aplicación cargada');
  }

  /** Configuración vigente. Copia defensiva: nadie muta la caché por fuera. */
  get(): AppSettingsValues {
    return { ...this.cached };
  }

  async update(patch: Partial<AppSettingsValues>): Promise<AppSettingsValues> {
    const document = await this.model
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
  async reset(): Promise<AppSettingsValues> {
    const document = await this.model
      .findOneAndUpdate(
        { key: SINGLETON_KEY },
        { $set: { ...APP_SETTINGS_DEFAULTS } },
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

  private toValues(document: AppSettings | null): AppSettingsValues {
    const source = document ?? APP_SETTINGS_DEFAULTS;
    return {
      defaultCacheTtlSeconds:
        source.defaultCacheTtlSeconds ??
        APP_SETTINGS_DEFAULTS.defaultCacheTtlSeconds,
    };
  }
}
