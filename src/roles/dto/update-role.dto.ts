import { z } from 'zod';
import { K, t } from '../../i18n';
import { isValidPermission } from '../../authz/permissions.catalog';
import { isValidRouteResource } from '../../authz/route-resources.catalog';
import { ESTADOS_ROLE } from '../schemas/role.schema';

export const updateRoleSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) })
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
  resources: z
    .array(
      z.string().refine(isValidRouteResource, {
        error: 'ruta desconocida (usa el catálogo o el comodín *)',
      }),
    )
    .optional(),
  status: z.enum(ESTADOS_ROLE).optional(),
});

export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
