import { z } from 'zod';
import { uuidSchema } from '../../common';

export const listCyclesSchema = z.object({
  unitId: uuidSchema.optional(),
});

export type ListCyclesDto = z.infer<typeof listCyclesSchema>;
