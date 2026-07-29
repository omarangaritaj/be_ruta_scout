import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  BRANCHES,
  GROWTH_AREAS,
  type Branch,
  type GrowthArea,
} from '../../domain';

export type GrowthItemDocument = HydratedDocument<GrowthItem>;

@Schema({ collection: 'growth_items', timestamps: true })
export class GrowthItem {
  @Prop({ type: String, enum: BRANCHES, required: true })
  branch: Branch;

  @Prop({ type: String, enum: GROWTH_AREAS, required: true })
  growthArea: GrowthArea;

  @Prop({ required: true, trim: true })
  text: string;

  @Prop({ type: Number, required: true })
  order: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const GrowthItemSchema = SchemaFactory.createForClass(GrowthItem);

GrowthItemSchema.index(
  { branch: 1, growthArea: 1, order: 1 },
  { unique: true },
);
