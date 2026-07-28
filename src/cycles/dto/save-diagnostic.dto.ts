import { z } from 'zod';
import { objectIdSchema } from '../../common';

export const saveDiagnosticSchema = z.object({
  answers: z.array(
    z.object({
      questionId: objectIdSchema,
      score: z.number().int().min(1).max(5),
      notes: z.string().trim().optional(),
    }),
  ),
  summary: z.string().trim().optional(),
});

export type SaveDiagnosticDto = z.infer<typeof saveDiagnosticSchema>;
