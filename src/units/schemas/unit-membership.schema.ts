import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { UNIT_ROLES, type UnitRole } from '../../domain';

export type UnitMembershipDocument = HydratedDocument<UnitMembership>;

@Schema({ collection: 'unit_memberships', timestamps: true })
export class UnitMembership {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Unit', required: true })
  unitId: Types.ObjectId;

  @Prop({ type: String, enum: UNIT_ROLES, required: true })
  role: UnitRole;

  @Prop({ type: Number, required: true, index: true })
  groupId: number;
}

export const UnitMembershipSchema =
  SchemaFactory.createForClass(UnitMembership);

UnitMembershipSchema.index({ userId: 1, unitId: 1 }, { unique: true });
UnitMembershipSchema.index({ unitId: 1 });
