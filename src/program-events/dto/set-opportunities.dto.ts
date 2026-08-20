import { z } from 'zod';
import { uuidSchema } from '../../common';

export const setOpportunitiesSchema = z.object({
  // El orden del arreglo ES la posición: el índice se persiste en `position`.
  opportunityIds: z.array(uuidSchema),
});

export type SetOpportunitiesDto = z.infer<typeof setOpportunitiesSchema>;
