import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type GrupoDocument = HydratedDocument<Grupo>;

@Schema({ collection: 'grupos', timestamps: true })
export class Grupo {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ required: true, trim: true })
  region: string;

  @Prop({ required: true, trim: true })
  ciudad: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  idJefeGrupo?: Types.ObjectId;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  dirigentes: Types.ObjectId[];
}

export const GrupoSchema = SchemaFactory.createForClass(Grupo);
