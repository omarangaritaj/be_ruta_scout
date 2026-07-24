import { z } from 'zod';
import { objectIdSchema } from '../../common';

/**
 * Forma base de un usuario, SIN valores por defecto.
 *
 * Los `.default()` viven únicamente en el esquema de creación: si estuvieran
 * aquí, `.partial()` los arrastraría al esquema de actualización y un PATCH
 * que no menciona un campo terminaría sobrescribiéndolo con su valor por
 * defecto (por ejemplo, vaciando el array de roles).
 */
export const userBaseSchema = z.object({
  name: z
    .string({ error: 'es obligatorio' })
    .trim()
    .min(1, { error: 'no puede estar vacío' }),

  idSiscout: z
    .string({ error: 'es obligatorio' })
    .trim()
    .min(1, { error: 'no puede estar vacío' }),

  roles: z.array(objectIdSchema),

  cargos: z.array(objectIdSchema),
});
