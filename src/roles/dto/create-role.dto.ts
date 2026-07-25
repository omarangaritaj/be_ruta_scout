import { z } from 'zod';
import { isValidPermission } from '../../authz/permissions.catalog';
import { ESTADOS_ROLE } from '../schemas/role.schema';

export const createRoleSchema = z.object({
  nombre: z
    .string({ error: 'es obligatorio' })
    .trim()
    .min(1, { error: 'no puede estar vacío' }),
  descripcion: z.string().trim().optional(),
  permissions: z
    .array(
      z.string().refine(isValidPermission, {
        error:
          'permiso desconocido (usa el catálogo o comodines * / recurso:*)',
      }),
    )
    .default([]),
  status: z.enum(ESTADOS_ROLE).default('activo'),
});

export type CreateRoleDto = z.infer<typeof createRoleSchema>;
