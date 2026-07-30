import { z } from 'zod';
import { K, t } from '../../i18n';
import { createOpportunitySchema } from './create-opportunity.dto';

export const updateOpportunitySchema = createOpportunitySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: t(K.VALIDATION.AT_LEAST_ONE_FIELD),
  });

export type UpdateOpportunityDto = z.infer<typeof updateOpportunitySchema>;
