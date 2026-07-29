import { z } from 'zod';
import { objectIdSchema } from '../../common';
import { K, t } from '../../i18n';

const requiredEnvironmentText = z
  .string()
  .trim()
  .min(1, { error: t(K.CYCLES.ENVIRONMENT_REQUIRED) });

export const updateFocusSchema = z.object({
  objective: z.string().trim().optional(),
  educationalFocus: z
    .string()
    .trim()
    .min(1, { error: t(K.CYCLES.EDUCATIONAL_FOCUS_REQUIRED) })
    .optional(),
  competencies: z
    .array(objectIdSchema)
    .min(1, { error: t(K.CYCLES.COMPETENCIES_REQUIRED) })
    .optional(),
  environmentName: requiredEnvironmentText.optional(),
  environmentConnection: requiredEnvironmentText.optional(),
});

export type UpdateFocusDto = z.infer<typeof updateFocusSchema>;
