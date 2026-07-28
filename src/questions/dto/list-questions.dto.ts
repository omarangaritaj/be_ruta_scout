import { z } from 'zod';
import { BRANCHES } from '../../domain';
import { K, t } from '../../i18n';

export const listQuestionsSchema = z.object({
  branch: z.enum(BRANCHES, { error: t(K.VALIDATION.INVALID_INPUT) }).optional(),
  includeInactive: z
    .stringbool({ error: t(K.VALIDATION.INVALID_INPUT) })
    .optional(),
});

export type ListQuestionsDto = z.infer<typeof listQuestionsSchema>;
