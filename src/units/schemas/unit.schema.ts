import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { BRANCHES, type Branch } from '../../domain';

export type UnitDocument = HydratedDocument<Unit>;

@Schema({ collection: 'units', timestamps: true })
export class Unit {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: BRANCHES, required: true, index: true })
  branch: Branch;

  @Prop({ type: Number, required: true, index: true })
  groupId: number;

  @Prop({ type: Number, index: true })
  districtId?: number;

  @Prop({ trim: true })
  districtName?: string;

  @Prop({ trim: true })
  city?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  unitLeaderId: Types.ObjectId;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  leaders: Types.ObjectId[];

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  members: Types.ObjectId[];

  @Prop({ type: Date })
  configuredAt?: Date;
}

export const UnitSchema = SchemaFactory.createForClass(Unit);

UnitSchema.index({ groupId: 1, name: 1 }, { unique: true });
