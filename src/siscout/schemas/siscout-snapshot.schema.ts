import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type SiscoutSnapshotDocument = HydratedDocument<SiscoutSnapshot>;

/**
 * Copia privada de la información que devuelve SiScout.
 *
 * ⚠️ ESTA COLECCIÓN NO SE EXPONE NUNCA. No tiene controlador, no se devuelve
 * desde ningún endpoint y su modelo no se exporta fuera de SiscoutModule.
 *
 * Vive separada de `users` a propósito: `select: false` NO protege frente a
 * `aggregate()` ni frente a `.select('+campo')`, porque solo actúa en la capa
 * de consulta de Mongoose. Un dato que no puede exponerse no puede estar en el
 * documento que sí se expone. Para alcanzar este payload desde `users` haría
 * falta un `$lookup` escrito explícitamente, que es código revisable.
 */
@Schema({ collection: 'siscout_snapshots', timestamps: true })
export class SiscoutSnapshot {
  /** Clave de correlación con `users.idSiscout`. */
  @Prop({ required: true, unique: true, index: true })
  idSiscout: string;

  /** Huella canónica del payload: si no cambia, no se reescribe nada. */
  @Prop({ required: true, index: true })
  hash: string;

  /** Respuesta cruda del servicio externo. */
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload: Record<string, unknown>;

  @Prop({ required: true })
  sincronizadoEn: Date;
}

export const SiscoutSnapshotSchema =
  SchemaFactory.createForClass(SiscoutSnapshot);
