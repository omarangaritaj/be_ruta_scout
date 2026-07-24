import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

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
}

export const UserSchema = SchemaFactory.createForClass(User);
