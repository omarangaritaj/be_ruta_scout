import { z } from 'zod';
import { questionBaseSchema } from './question-base.schema';

export const createQuestionSchema = questionBaseSchema.omit({ isActive: true });

export type CreateQuestionDto = z.infer<typeof createQuestionSchema>;
