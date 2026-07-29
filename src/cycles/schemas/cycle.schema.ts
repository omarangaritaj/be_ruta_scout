import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  DIAGNOSTIC_BLOCKS,
  type DiagnosticBlock,
  GROWTH_AREAS,
  type GrowthArea,
} from '../../domain';

export type CycleDocument = HydratedDocument<Cycle>;

@Schema({ _id: false })
export class DiagnosticAnswer {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Question',
    required: true,
  })
  questionId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  questionText: string;

  @Prop({ type: String, enum: DIAGNOSTIC_BLOCKS, required: true })
  block: DiagnosticBlock;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  score: number;

  @Prop({ trim: true })
  notes?: string;
}

export const DiagnosticAnswerSchema =
  SchemaFactory.createForClass(DiagnosticAnswer);

@Schema({ _id: false })
export class CycleCompetency {
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

export const CycleCompetencySchema =
  SchemaFactory.createForClass(CycleCompetency);

@Schema({ _id: false })
export class CycleFocus {
  @Prop({ trim: true })
  objective?: string;

  @Prop({ trim: true })
  educationalFocus?: string;

  @Prop({ type: [CycleCompetencySchema], default: [] })
  competencies: CycleCompetency[];

  @Prop({ trim: true })
  environmentName?: string;

  @Prop({ trim: true })
  environmentConnection?: string;
}

export const CycleFocusSchema = SchemaFactory.createForClass(CycleFocus);

@Schema({ collection: 'cycles', timestamps: true })
export class Cycle {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Unit', required: true })
  unitId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: [DiagnosticAnswerSchema], default: [] })
  diagnosticAnswers: DiagnosticAnswer[];

  @Prop({ trim: true })
  diagnosticSummary?: string;

  @Prop({ type: CycleFocusSchema, default: () => ({}) })
  focus: CycleFocus;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const CycleSchema = SchemaFactory.createForClass(Cycle);
