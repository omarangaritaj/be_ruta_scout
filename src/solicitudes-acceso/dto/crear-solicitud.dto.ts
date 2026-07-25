import { z } from 'zod';
import { NIVELES_SOLICITUD } from '../../catalogo-cargos/catalogo-cargos';
import { RAMAS } from '../schemas/solicitud-acceso.schema';

const TELEFONO_RE = /^\+?[\d\s\-().]{7,20}$/;

export const crearSolicitudSchema = z.object({
  nivel: z.enum(NIVELES_SOLICITUD, {
    error: `debe ser uno de: ${NIVELES_SOLICITUD.join(', ')}`,
  }),
  cargo: z
    .string({ error: 'es obligatorio' })
    .trim()
    .min(1, { error: 'no puede estar vacío' }),
  telefono: z
    .string({ error: 'es obligatorio' })
    .trim()
    .regex(TELEFONO_RE, { error: 'no es un teléfono válido' }),
  rama: z.enum(RAMAS).optional(),
  groupId: z.number().int().positive().optional(),
  districtId: z.number().int().positive().optional(),
});

export type CrearSolicitudDto = z.infer<typeof crearSolicitudSchema>;
