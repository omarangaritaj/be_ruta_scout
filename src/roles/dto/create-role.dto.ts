import { z } from 'zod';
import { K, t } from '../../i18n';
import { isValidPermission } from '../../authz/permissions.catalog';
import { ESTADOS_ROLE } from '../schemas/role.schema';

export const createRoleSchema = z.object({
  nombre: z
    .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) }),
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
