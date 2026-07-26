import { z } from 'zod';
import { K, t } from '../../i18n';

export const refreshSchema = z.object({
  refreshToken: z
    .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) }),
});

export type RefreshDto = z.infer<typeof refreshSchema>;
