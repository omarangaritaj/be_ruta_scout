import { z } from 'zod';
import { objectIdSchema } from '../../common';

/**
 * Destino de quienes hoy tienen el rol que se va a eliminar.
 *
 * `reassignments` nombra a personas concretas y `defaultTargetRoleId` recoge a
 * todo el resto. El destino por defecto no es un atajo de la UI: es lo que hace
 * la operación correcta cuando alguien recibe el rol mientras el diálogo está
 * abierto. Una lista de ids cerrada en el navegador no puede cubrir a quien
 * todavía no existía cuando se abrió.
 *
 * Ambos pueden faltar: si nadie tiene ya el rol, la operación solo borra.
 */
export const reassignRoleSchema = z.object({
  defaultTargetRoleId: objectIdSchema.optional(),
  reassignments: z
    .array(
      z.object({
        userId: objectIdSchema,
        targetRoleId: objectIdSchema,
      }),
    )
    .default([]),
});

export type ReassignRoleDto = z.infer<typeof reassignRoleSchema>;
