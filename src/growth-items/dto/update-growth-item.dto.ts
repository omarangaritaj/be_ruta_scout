import { z } from 'zod';
import { K, t } from '../../i18n';
import { growthItemBaseSchema } from './growth-item-base.schema';

export const updateGrowthItemSchema = growthItemBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: t(K.VALIDATION.AT_LEAST_ONE_FIELD),
  });

export type UpdateGrowthItemDto = z.infer<typeof updateGrowthItemSchema>;
