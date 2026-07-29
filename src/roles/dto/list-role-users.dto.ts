import { z } from 'zod';

/**
 * Paginación de las personas que tienen un rol. El `pageSize` por defecto es 10
 * porque es lo que muestra de golpe el diálogo de eliminación del panel.
 */
export const listRoleUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type ListRoleUsersDto = z.infer<typeof listRoleUsersSchema>;
