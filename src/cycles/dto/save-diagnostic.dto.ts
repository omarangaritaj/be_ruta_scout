import { z } from 'zod';
import { objectIdSchema } from '../../common';
import { K, t } from '../../i18n';

export const saveDiagnosticSchema = z.object({
  answers: z.array(
    z.object({
      questionId: objectIdSchema,
      score: z.number().int().min(1).max(5),
      notes: z.string().trim().optional(),
    }),
  ),
  summary: z
    .string()
    .trim()
    .min(1, { error: t(K.CYCLES.SUMMARY_REQUIRED) }),
});

export type SaveDiagnosticDto = z.infer<typeof saveDiagnosticSchema>;
