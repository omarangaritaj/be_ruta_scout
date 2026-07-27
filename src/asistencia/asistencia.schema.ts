import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AsistenciaDocument = HydratedDocument<Asistencia>;

/**
 * Registro de asistencia capturado en campo (offline-first). El `_id` es un UUID
 * que genera el cliente SIN conexión, por eso es `String` y no `ObjectId`; los
 * ids de referencia también van como `String` para casar con el SQLite local de
 * PowerSync (allí todo id es TEXT). PowerSync exige una PK de una sola columna.
 */
@Schema({ collection: 'asistencia', timestamps: true })
export class Asistencia {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  unitId: string;

  @Prop({ type: String, required: true })
  idProtagonista: string;

  @Prop({ type: Date, required: true })
  fecha: Date;

  @Prop({ default: true })
  presente: boolean;

  @Prop({ type: String })
  registradoPor?: string;
}

export const AsistenciaSchema = SchemaFactory.createForClass(Asistencia);
