import { z } from 'zod';
import { K, t } from '../../i18n';
import { hasValidRange } from '../cycle-dates';

export const updateCycleSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: t(K.VALIDATION.AT_LEAST_ONE_FIELD),
  })
  .refine(
    (data) =>
      data.startDate === undefined || data.endDate === undefined
        ? true
        : hasValidRange(data.startDate, data.endDate),
    { error: t(K.CYCLES.INVALID_DATE_RANGE), path: ['endDate'] },
  );

export type UpdateCycleDto = z.infer<typeof updateCycleSchema>;
