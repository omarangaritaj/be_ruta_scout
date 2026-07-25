import { z } from 'zod';
import { isValidPermission } from '../../authz/permissions.catalog';
import { ESTADOS_ROLE } from '../schemas/role.schema';

export const updateRoleSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, { error: 'no puede estar vacío' })
    .optional(),
  descripcion: z.string().trim().optional(),
  permissions: z
    .array(
      z.string().refine(isValidPermission, {
        error:
          'permiso desconocido (usa el catálogo o comodines * / recurso:*)',
      }),
    )
    .optional(),
  status: z.enum(ESTADOS_ROLE).optional(),
});

export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
