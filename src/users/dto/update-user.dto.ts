import { z } from 'zod';
import { K, t } from '../../i18n';
import { objectIdSchema } from '../../common';
import { cargoSchema } from './cargo.schema';
import { protagonistaFieldsSchema } from './protagonista.schema';

/**
 * Niveles de acceso otorgables al gestionar un usuario. Excluye `super_admin`:
 * ese estatus no se concede editando desde el panel.
 */
export const NIVELES_OTORGABLES = [
  'rama',
  'grupo',
  'region',
  'nacion',
] as const;

/**
 * Estados de acceso fijables a mano al gestionar. `aprobado`/`suspendido` son
 * las dos caras de la gestión (reactivar/suspender); `pendiente`, `rechazado` y
 * `sin_solicitud` los produce el flujo de solicitudes, no una edición directa.
 */
export const ESTADOS_ACCESO_GESTIONABLES = ['aprobado', 'suspendido'] as const;

/**
 * Actualización de una persona. `tipo` e `idSiscout` NO se cambian por PATCH
 * (son su identidad). Todos los campos son opcionales y se exige al menos uno.
 *
 * `estado` es la activación en la plataforma; se puede alternar aquí.
 * `estadoSiscout` NO se toca a mano: lo gobierna el sync.
 *
 * Los campos de gestión de acceso (`nivelAcceso`, `estadoAcceso`, territorio) se
 * editan aquí mismo: el guard de `user:approve` y la regla anti-auto-modificación
 * viven en el servicio, no en este esquema.
 */
export const updateUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) }),
    estado: z.boolean(),
    roles: z.array(objectIdSchema),
    cargos: z.array(cargoSchema),
    nivelAcceso: z.enum(NIVELES_OTORGABLES),
    estadoAcceso: z.enum(ESTADOS_ACCESO_GESTIONABLES),
    districtId: z.number().int().positive(),
    districtName: z.string().trim().min(1),
    groupId: z.number().int().positive(),
    groupName: z.string().trim().min(1),
  })
  .extend(protagonistaFieldsSchema.shape)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: t(K.VALIDATION.AT_LEAST_ONE_FIELD),
  });

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
