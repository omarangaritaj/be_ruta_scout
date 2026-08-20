import { z } from 'zod';
import { K, t } from '../../i18n';
import { createOpportunitySchema } from './create-opportunity.dto';

export const updateOpportunitySchema = createOpportunitySchema
  .partial()
  // isSelected no viaja en la creación: nace en false y solo se alterna desde
  // la tabla de propuesta de oportunidades.
  .extend({ isSelected: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, {
    error: t(K.VALIDATION.AT_LEAST_ONE_FIELD),
  });

export type UpdateOpportunityDto = z.infer<typeof updateOpportunitySchema>;
