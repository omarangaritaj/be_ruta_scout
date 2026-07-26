import { z } from 'zod';

/** Estados gestionables desde el panel: quienes ya tienen acceso. */
export const ESTADOS_GESTIONABLES = ['aprobado', 'suspendido'] as const;

/** Niveles filtrables (el super_admin nunca se lista aquí). */
export const NIVELES_FILTRABLES = [
  'rama',
  'grupo',
  'region',
  'nacion',
] as const;

/**
 * Filtros de la lista de usuarios. Llegan como query string, así que los
 * numéricos se coaccionan. `page`/`pageSize` tienen defaults para que un GET
 * sin parámetros devuelva la primera página.
 */
export const listUsersSchema = z.object({
  estado: z.enum(ESTADOS_GESTIONABLES).optional(),
  nivel: z.enum(NIVELES_FILTRABLES).optional(),
  region: z.coerce.number().int().positive().optional(),
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListUsersDto = z.infer<typeof listUsersSchema>;

export interface PaginatedUsers<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
