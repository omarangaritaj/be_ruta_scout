import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SISCOUT_CONFIG_DEFAULTS } from '../siscout-config.defaults';

export type SiscoutConfigDocument = HydratedDocument<SiscoutConfig>;

/**
 * Configuración operativa de SiScout.
 *
 * Es un documento ÚNICO: el campo `key` con índice único garantiza que solo
 * pueda existir uno. No es un recurso de muchos registros, sino los ajustes del
 * sistema, así que no tiene alta ni baja: se lee, se actualiza y se restablece.
 */
@Schema({ collection: 'siscout_config', timestamps: true })
export class SiscoutConfig {
  /** Discriminador del singleton. Siempre 'default'. */
  @Prop({ required: true, unique: true, default: 'default' })
  key: string;

  @Prop({ type: [Number], default: SISCOUT_CONFIG_DEFAULTS.zoneIds })
  zoneIds: number[];

  @Prop({ default: SISCOUT_CONFIG_DEFAULTS.pageLength })
  pageLength: number;

  @Prop({ default: SISCOUT_CONFIG_DEFAULTS.maxPages })
  maxPages: number;

  @Prop({ default: SISCOUT_CONFIG_DEFAULTS.minMainZoneRecords })
  minMainZoneRecords: number;

  @Prop({ default: SISCOUT_CONFIG_DEFAULTS.writeChunkSize })
  writeChunkSize: number;

  @Prop({ default: SISCOUT_CONFIG_DEFAULTS.syncCron })
  syncCron: string;

  @Prop({ default: SISCOUT_CONFIG_DEFAULTS.syncEnabled })
  syncEnabled: boolean;
}

export const SiscoutConfigSchema = SchemaFactory.createForClass(SiscoutConfig);
