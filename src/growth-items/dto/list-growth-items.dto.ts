import { z } from 'zod';
import { BRANCHES, GROWTH_AREAS } from '../../domain';
import { K, t } from '../../i18n';

export const listGrowthItemsSchema = z.object({
  branch: z.enum(BRANCHES, { error: t(K.VALIDATION.INVALID_INPUT) }).optional(),
  growthArea: z
    .enum(GROWTH_AREAS, { error: t(K.VALIDATION.INVALID_INPUT) })
    .optional(),
  includeInactive: z
    .stringbool({ error: t(K.VALIDATION.INVALID_INPUT) })
    .optional(),
});

export type ListGrowthItemsDto = z.infer<typeof listGrowthItemsSchema>;
