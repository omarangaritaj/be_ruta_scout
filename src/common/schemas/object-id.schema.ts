import { Types } from 'mongoose';
import { z } from 'zod';

/**
 * Valida un ObjectId recibido como string y lo transforma a `Types.ObjectId`.
 *
 * Se usa una expresión regular de 24 hexadecimales en lugar de
 * `Types.ObjectId.isValid()` porque este último también da por válida
 * cualquier cadena de 12 caracteres, lo que deja pasar basura.
 */
export const objectIdSchema = z
  .string({ error: 'debe ser una cadena de texto' })
  .regex(/^[0-9a-fA-F]{24}$/, {
    error: 'debe ser un ObjectId válido (24 caracteres hexadecimales)',
  })
  .transform((value) => new Types.ObjectId(value));
