import { z } from 'zod';
import { K, t } from '../../i18n';
import { unitBaseSchema } from './unit-base.schema';

export const updateUnitSchema = unitBaseSchema
  .omit({ branch: true, groupId: true, members: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: t(K.VALIDATION.AT_LEAST_ONE_FIELD),
  });

export type UpdateUnitDto = z.infer<typeof updateUnitSchema>;
