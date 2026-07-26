import { z } from 'zod';
import { K, t } from '../../i18n';
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
    .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) }),

  region: z
    .string({ error: t(K.VALIDATION.REQUIRED_FEMININE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_FEMININE) }),

  ciudad: z
    .string({ error: t(K.VALIDATION.REQUIRED_FEMININE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_FEMININE) }),

  idJefeGrupo: objectIdSchema.optional(),

  dirigentes: z.array(objectIdSchema),
});
