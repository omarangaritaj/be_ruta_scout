import { z } from 'zod';
import { uuidSchema } from '../../common';
import { NIVELES_SOLICITUD } from '../../catalogo-cargos/catalogo-cargos';

const nota = z.string().trim().min(1).optional();

export const aprobarSolicitudSchema = z.object({
  nivel: z.enum(NIVELES_SOLICITUD).optional(),
  cargo: z.string().trim().min(1).optional(),
  /**
   * Roles RBAC que se conceden junto con el acceso. Opcional: aprobar sin
   * roles sigue siendo válido (la persona entra con lo que le dé su nivel).
   * Quién puede conceder cuáles lo decide `assertCanGrantRoles`, no este
   * esquema: un rol solo se concede si el aprobador ya tiene todo lo que ese
   * rol otorga.
   */
  roleIds: z.array(uuidSchema).optional(),
  nota,
});
export type AprobarSolicitudDto = z.infer<typeof aprobarSolicitudSchema>;

export const rechazarSolicitudSchema = z.object({ nota });
export type RechazarSolicitudDto = z.infer<typeof rechazarSolicitudSchema>;
