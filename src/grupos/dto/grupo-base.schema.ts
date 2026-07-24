import { z } from 'zod';
import { objectIdSchema } from '../../common';

/**
 * Forma base de un grupo, SIN valores por defecto.
 *
 * Los `.default()` viven únicamente en el esquema de creación: si estuvieran
 * aquí, `.partial()` los arrastraría al esquema de actualización y un PATCH
 * que no menciona un campo terminaría sobrescribiéndolo con su valor por
 * defecto (por ejemplo, vaciando el array de dirigentes).
 */
export const grupoBaseSchema = z.object({
  nombre: z
    .string({ error: 'es obligatorio' })
    .trim()
    .min(1, { error: 'no puede estar vacío' }),

  region: z
    .string({ error: 'es obligatoria' })
    .trim()
    .min(1, { error: 'no puede estar vacía' }),

  ciudad: z
    .string({ error: 'es obligatoria' })
    .trim()
    .min(1, { error: 'no puede estar vacía' }),

  idJefeGrupo: objectIdSchema.optional(),

  dirigentes: z.array(objectIdSchema),
});
