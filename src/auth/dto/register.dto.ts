import { z } from 'zod';
import { K, t } from '../../i18n';

export const registerSchema = z.object({
  cedula: z
    .string({ error: t(K.VALIDATION.REQUIRED_FEMININE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_FEMININE) }),
  password: z
    .string({ error: t(K.VALIDATION.REQUIRED_FEMININE) })
    .min(8, { error: t(K.VALIDATION.PASSWORD_MIN_LENGTH) })
    .refine((valor) => Buffer.byteLength(valor, 'utf8') <= 72, {
      error: t(K.VALIDATION.PASSWORD_MAX_BYTES),
    }),
});

export type RegisterDto = z.infer<typeof registerSchema>;
