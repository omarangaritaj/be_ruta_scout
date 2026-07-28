import { z } from 'zod';
import { objectIdSchema } from '../../common';
import { K, t } from '../../i18n';
import { hasValidRange } from '../cycle-dates';

export const createCycleSchema = z
  .object({
    unitId: objectIdSchema,
    name: z.string().trim().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => hasValidRange(data.startDate, data.endDate), {
    error: t(K.CYCLES.INVALID_DATE_RANGE),
    path: ['endDate'],
  });

export type CreateCycleDto = z.infer<typeof createCycleSchema>;
