import { z } from 'zod';
import { NIVELES_SOLICITUD } from '../../catalogo-cargos/catalogo-cargos';

const nota = z.string().trim().min(1).optional();

export const aprobarSolicitudSchema = z.object({
  nivel: z.enum(NIVELES_SOLICITUD).optional(),
  cargo: z.string().trim().min(1).optional(),
  nota,
});
export type AprobarSolicitudDto = z.infer<typeof aprobarSolicitudSchema>;

export const rechazarSolicitudSchema = z.object({ nota });
export type RechazarSolicitudDto = z.infer<typeof rechazarSolicitudSchema>;
