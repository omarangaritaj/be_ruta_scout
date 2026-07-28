import { z } from 'zod';

export const updateFocusSchema = z.object({
  objective: z.string().trim().optional(),
  educationalFocus: z.string().trim().optional(),
  competencies: z.array(z.string().trim().min(1)).optional(),
  environmentName: z.string().trim().optional(),
  environmentConnection: z.string().trim().optional(),
});

export type UpdateFocusDto = z.infer<typeof updateFocusSchema>;
