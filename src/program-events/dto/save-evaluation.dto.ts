import { z } from 'zod';

export const saveEvaluationSchema = z.object({
  summary: z.string().trim().min(1),
  achievements: z.string().trim().optional(),
  improvements: z.string().trim().optional(),
  recordedAt: z.string(),
});

export type SaveEvaluationDto = z.infer<typeof saveEvaluationSchema>;
