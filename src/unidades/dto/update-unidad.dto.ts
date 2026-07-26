import { z } from 'zod';
import { K, t } from '../../i18n';
import { unidadBaseSchema } from './unidad-base.schema';

/**
 * Todos los campos opcionales y sin defaults: solo se modifica lo que llega.
 * Se exige al menos un campo para no aceptar un PATCH que no hace nada.
 */
export const updateUnidadSchema = unidadBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: t(K.VALIDATION.AT_LEAST_ONE_FIELD),
  });

export type UpdateUnidadDto = z.infer<typeof updateUnidadSchema>;
