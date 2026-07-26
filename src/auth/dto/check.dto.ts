import { z } from 'zod';
import { K, t } from '../../i18n';

export const checkSchema = z.object({
  cedula: z
    .string({ error: t(K.VALIDATION.REQUIRED_FEMININE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_FEMININE) }),
});

export type CheckDto = z.infer<typeof checkSchema>;
