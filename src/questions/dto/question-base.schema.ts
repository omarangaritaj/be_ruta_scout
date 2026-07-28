import { z } from 'zod';
import { BRANCHES, DIAGNOSTIC_BLOCKS } from '../../domain';
import { K, t } from '../../i18n';

export const questionBaseSchema = z.object({
  branch: z.enum(BRANCHES, { error: t(K.VALIDATION.INVALID_INPUT) }),
  block: z.enum(DIAGNOSTIC_BLOCKS, { error: t(K.VALIDATION.INVALID_INPUT) }),
  text: z
    .string()
    .trim()
    .min(1, { error: t(K.VALIDATION.INVALID_INPUT) }),
  order: z.number().int(),
  isActive: z.boolean().optional(),
});
