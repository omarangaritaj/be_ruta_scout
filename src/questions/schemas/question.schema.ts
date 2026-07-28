import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  BRANCHES,
  DIAGNOSTIC_BLOCKS,
  type Branch,
  type DiagnosticBlock,
} from '../../domain';

export type QuestionDocument = HydratedDocument<Question>;

@Schema({ collection: 'questions', timestamps: true })
export class Question {
  @Prop({ type: String, enum: BRANCHES, required: true })
  branch: Branch;

  @Prop({ type: String, enum: DIAGNOSTIC_BLOCKS, required: true })
  block: DiagnosticBlock;

  @Prop({ required: true, trim: true })
  text: string;

  @Prop({ type: Number, required: true })
  order: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
