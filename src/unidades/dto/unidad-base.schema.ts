import { z } from 'zod';
import { objectIdSchema } from '../../common';

/**
 * Forma base de una unidad, SIN valores por defecto.
 *
 * Los `.default()` viven únicamente en el esquema de creación: si estuvieran
 * aquí, `.partial()` los arrastraría al esquema de actualización y un PATCH
 * que no menciona un campo terminaría sobrescribiéndolo con su valor por
 * defecto (por ejemplo, vaciando el array de dirigentes).
 */
export const unidadBaseSchema = z.object({
  nombre: z
    .string({ error: 'es obligatorio' })
    .trim()
    .min(1, { error: 'no puede estar vacío' }),

  // Obligatorio: el schema de Mongoose lo declara `required`. Si aquí fuera
  // opcional, Zod dejaría pasar la petición y Mongoose la rechazaría después
  // con un 500 en lugar de un 400 explicando qué falta.
  idJefeUnidad: objectIdSchema,

  dirigentes: z.array(objectIdSchema),

  protagonistas: z.array(objectIdSchema),
});
