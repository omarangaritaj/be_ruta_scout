import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export const ESTADOS_SISCOUT = ['activo', 'huerfano'] as const;
export type EstadoSiscout = (typeof ESTADOS_SISCOUT)[number];

/**
 * Usuario de la aplicación.
 *
 * ⚠️ Este documento NO contiene la información de SiScout. El payload externo
 * vive aislado en la colección `siscout_snapshots`, que nunca se expone. Aquí
 * solo se proyectan los campos declarados en la lista blanca de la
 * sincronización (ver `siscout-sync.service.ts`).
 */
@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, unique: true, index: true })
  idSiscout: string;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Role', default: [] })
  roles: Types.ObjectId[];

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Cargo', default: [] })
  cargos: Types.ObjectId[];

  /** `huerfano` cuando SiScout deja de reportar el registro. */
  @Prop({
    type: String,
    enum: ESTADOS_SISCOUT,
    default: 'activo',
    index: true,
  })
  estadoSiscout: EstadoSiscout;

  /** Momento en que SiScout lo reportó por última vez. */
  @Prop({ type: Date })
  sincronizadoEn?: Date;

  /**
   * Identificador de la última corrida que vio este registro.
   *
   * Es lo que permite detectar huérfanos con una sola consulta al final:
   * quien no lleve el identificador de la corrida actual, ya no vino.
   */
  @Prop({ type: String, index: true })
  ultimoSyncId?: string;

  /** Cuándo se marcó como huérfano. Se limpia si el registro reaparece. */
  @Prop({ type: Date })
  huerfanoDesde?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
