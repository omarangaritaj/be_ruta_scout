import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { RAMAS, type Rama } from '../../catalogo-cargos/ramas';

export type UnidadDocument = HydratedDocument<Unidad>;

@Schema({ collection: 'unidades', timestamps: true })
export class Unidad {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ type: String, enum: RAMAS, required: true, index: true })
  rama: Rama;

  @Prop({ type: Number, required: true, index: true })
  groupId: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  idJefeUnidad: Types.ObjectId;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  dirigentes: Types.ObjectId[];

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  protagonistas: Types.ObjectId[];
}

export const UnidadSchema = SchemaFactory.createForClass(Unidad);

// Un grupo tiene como mucho una unidad por rama. El índice único es lo que
// impide duplicarla cuando dos dirigentes de la misma rama entran a la vez.
UnidadSchema.index({ groupId: 1, rama: 1 }, { unique: true });
