import { z } from 'zod';
import { BRANCHES, GROWTH_AREAS } from '../../domain';
import { K, t } from '../../i18n';

export const growthItemBaseSchema = z.object({
  branch: z.enum(BRANCHES, { error: t(K.VALIDATION.INVALID_INPUT) }),
  growthArea: z.enum(GROWTH_AREAS, { error: t(K.VALIDATION.INVALID_INPUT) }),
  text: z
    .string()
    .trim()
    .min(1, { error: t(K.VALIDATION.INVALID_INPUT) }),
  order: z.number().int(),
  isActive: z.boolean().optional(),
});
