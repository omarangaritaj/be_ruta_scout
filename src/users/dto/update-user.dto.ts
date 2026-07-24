import { z } from 'zod';
import { userBaseSchema } from './user-base.schema';

/**
 * Todos los campos opcionales y sin defaults: solo se modifica lo que llega.
 * Se exige al menos un campo para no aceptar un PATCH que no hace nada.
 */
export const updateUserSchema = userBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: 'debe incluir al menos un campo a modificar',
  });

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
