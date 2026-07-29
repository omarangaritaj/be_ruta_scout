import { z } from 'zod';

/**
 * Paginación de las personas que tienen un rol. El diálogo de eliminación las
 * pide TODAS de una vez para poder darle destino a cada una sin cambiar de
 * página, así que el tope es alto. No es ilimitado a propósito: es la red que
 * impide que un rol masivo se traiga la colección entera en una respuesta.
 */
export const MAX_ROLE_USERS_PAGE = 500;

export const listRoleUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_ROLE_USERS_PAGE)
    .default(MAX_ROLE_USERS_PAGE),
});

export type ListRoleUsersDto = z.infer<typeof listRoleUsersSchema>;
