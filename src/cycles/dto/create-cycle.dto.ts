import { z } from 'zod';
import { uuidSchema } from '../../common';
import { K, t } from '../../i18n';
import { hasValidRange } from '../cycle-dates';

export const createCycleSchema = z
  .object({
    unitId: uuidSchema,
    name: z.string().trim().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => hasValidRange(data.startDate, data.endDate), {
    error: t(K.CYCLES.INVALID_DATE_RANGE),
    path: ['endDate'],
  });

export type CreateCycleDto = z.infer<typeof createCycleSchema>;
