import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  GROWTH_AREAS,
  type GrowthArea,
  OPPORTUNITY_AUDIENCES,
  type OpportunityAudience,
} from '../../domain';

export type LearningOpportunityDocument = HydratedDocument<LearningOpportunity>;

@Schema({ _id: false })
export class OpportunityCompetency {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'GrowthItem',
    required: true,
  })
  growthItemId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  text: string;

  @Prop({ type: String, enum: GROWTH_AREAS, required: true })
  growthArea: GrowthArea;
}

export const OpportunityCompetencySchema = SchemaFactory.createForClass(
  OpportunityCompetency,
);

@Schema({ collection: 'learning_opportunities', timestamps: true })
export class LearningOpportunity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Cycle', required: true })
  cycleId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true, trim: true })
  protagonistVoice: string;

  @Prop({ type: OpportunityCompetencySchema, required: true })
  competency: OpportunityCompetency;

  @Prop({ type: String, enum: OPPORTUNITY_AUDIENCES, required: true })
  audience: OpportunityAudience;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const LearningOpportunitySchema =
  SchemaFactory.createForClass(LearningOpportunity);
