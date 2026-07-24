import { z } from 'zod';
import { grupoBaseSchema } from './grupo-base.schema';

/**
 * Todos los campos opcionales y sin defaults: solo se modifica lo que llega.
 * Se exige al menos un campo para no aceptar un PATCH que no hace nada.
 */
export const updateGrupoSchema = grupoBaseSchema
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, {
    error: 'debe incluir al menos un campo a modificar',
  });

export type UpdateGrupoDto = z.infer<typeof updateGrupoSchema>;
