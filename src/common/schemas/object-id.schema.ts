import { Types } from 'mongoose';
import { z } from 'zod';
import { K, t } from '../../i18n';

/**
 * Valida un ObjectId recibido como string y lo transforma a `Types.ObjectId`.
 *
 * Se usa una expresión regular de 24 hexadecimales en lugar de
 * `Types.ObjectId.isValid()` porque este último también da por válida
 * cualquier cadena de 12 caracteres, lo que deja pasar basura.
 */
export const objectIdSchema = z
  .string({ error: t(K.VALIDATION.MUST_BE_STRING) })
  .regex(/^[0-9a-fA-F]{24}$/, {
    error: t(K.VALIDATION.OBJECT_ID),
  })
  .transform((value) => new Types.ObjectId(value));
