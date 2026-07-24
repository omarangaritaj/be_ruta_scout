import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type UnidadDocument = HydratedDocument<Unidad>;

@Schema({ collection: 'unidades', timestamps: true })
export class Unidad {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  idJefeUnidad: Types.ObjectId;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  dirigentes: Types.ObjectId[];

  @Prop({
    type: [MongooseSchema.Types.ObjectId],
    ref: 'Protagonista',
    default: [],
  })
  protagonistas: Types.ObjectId[];
}

export const UnidadSchema = SchemaFactory.createForClass(Unidad);
