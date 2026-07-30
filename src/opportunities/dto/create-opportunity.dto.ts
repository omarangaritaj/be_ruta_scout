import { z } from 'zod';
import { objectIdSchema } from '../../common';
import { OPPORTUNITY_AUDIENCES } from '../../domain';
import { K, t } from '../../i18n';

export const createOpportunitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: t(K.VALIDATION.INVALID_INPUT) }),
  description: z
    .string()
    .trim()
    .min(1, { error: t(K.VALIDATION.INVALID_INPUT) }),
  protagonistVoice: z
    .string()
    .trim()
    .min(1, { error: t(K.VALIDATION.INVALID_INPUT) }),
  competencyId: objectIdSchema,
  audience: z.enum(OPPORTUNITY_AUDIENCES, {
    error: t(K.VALIDATION.INVALID_INPUT),
  }),
});

export type CreateOpportunityDto = z.infer<typeof createOpportunitySchema>;
