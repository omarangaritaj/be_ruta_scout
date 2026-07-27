import { z } from 'zod';
import { K, t } from '../../i18n';

/**
 * Qué es una contraseña aceptable, en un solo sitio: lo usan el registro y el
 * restablecimiento. El máximo se mide en BYTES y no en caracteres porque bcrypt
 * trunca a 72 bytes, y una tilde o un emoji ocupan más de uno.
 */
export const passwordSchema = z
  .string({ error: t(K.VALIDATION.REQUIRED_FEMININE) })
  .min(8, { error: t(K.VALIDATION.PASSWORD_MIN_LENGTH) })
  .refine((valor) => Buffer.byteLength(valor, 'utf8') <= 72, {
    error: t(K.VALIDATION.PASSWORD_MAX_BYTES),
  });
