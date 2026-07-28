import { z } from 'zod';
import { K, t } from '../../i18n';
import { questionBaseSchema } from './question-base.schema';

export const updateQuestionSchema = questionBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: t(K.VALIDATION.AT_LEAST_ONE_FIELD),
  });

export type UpdateQuestionDto = z.infer<typeof updateQuestionSchema>;
