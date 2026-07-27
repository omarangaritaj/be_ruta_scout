import { z } from 'zod';
import { passwordSchema } from '../../auth/dto/password.schema';
import { K, t } from '../../i18n';

export const confirmResetSchema = z.object({
  token: z
    .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) }),
  password: passwordSchema,
});

export type ConfirmResetDto = z.infer<typeof confirmResetSchema>;
