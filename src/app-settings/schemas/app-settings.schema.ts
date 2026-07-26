import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { APP_SETTINGS_DEFAULTS } from '../app-settings.defaults';

export type AppSettingsDocument = HydratedDocument<AppSettings>;

/**
 * Configuración general de la aplicación (colección `app_config`).
 *
 * Documento ÚNICO: el campo `key` con índice único garantiza un solo registro.
 * No es un recurso de muchas filas, sino los ajustes globales del sistema, así
 * que no tiene alta ni baja: se lee, se actualiza y se restablece.
 *
 * La clase se llama `AppSettings` (y no `AppConfig`) a propósito: `AppConfig*`
 * ya nombra el módulo/servicio del entorno (`src/config`, sobre @nestjs/config).
 * Aquí son ajustes persistidos y editables en caliente, no variables de entorno.
 */
@Schema({ collection: 'app_config', timestamps: true })
export class AppSettings {
  /** Discriminador del singleton. Siempre 'default'. */
  @Prop({ required: true, unique: true, default: 'default' })
  key: string;

  @Prop({ default: APP_SETTINGS_DEFAULTS.defaultCacheTtlSeconds })
  defaultCacheTtlSeconds: number;
}

export const AppSettingsSchema = SchemaFactory.createForClass(AppSettings);
