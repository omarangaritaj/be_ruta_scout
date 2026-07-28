import { z } from 'zod';
import { objectIdSchema } from '../../common';

export const listCyclesSchema = z.object({
  unitId: objectIdSchema.optional(),
});

export type ListCyclesDto = z.infer<typeof listCyclesSchema>;
