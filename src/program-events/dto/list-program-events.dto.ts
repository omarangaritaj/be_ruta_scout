import { z } from 'zod';
import { uuidSchema } from '../../common';
import { PROGRAM_EVENT_KINDS } from '../../domain';

export const listProgramEventsSchema = z.object({
  unitId: uuidSchema.optional(),
  cycleId: uuidSchema.optional(),
  kind: z.enum(PROGRAM_EVENT_KINDS).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListProgramEventsDto = z.infer<typeof listProgramEventsSchema>;
