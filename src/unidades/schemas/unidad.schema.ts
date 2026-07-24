import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type UnidadDocument = HydratedDocument<Unidad>;

@Schema({ collection: 'unidades', timestamps: true })
export class Unidad {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ required: true, trim: true })
  region: string;

  @Prop({ required: true, trim: true })
  ciudad: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  idJefeGrupo?: Types.ObjectId;
}

export const UnidadSchema = SchemaFactory.createForClass(Unidad);
