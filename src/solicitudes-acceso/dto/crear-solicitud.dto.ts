import { z } from 'zod';
import { K, t } from '../../i18n';
import { NIVELES_SOLICITUD } from '../../catalogo-cargos/catalogo-cargos';
import { RAMAS } from '../solicitud-acceso.entity';

const TELEFONO_RE = /^\+?[\d\s\-().]{7,20}$/;

export const crearSolicitudSchema = z.object({
  nivel: z.enum(NIVELES_SOLICITUD, {
    error: `debe ser uno de: ${NIVELES_SOLICITUD.join(', ')}`,
  }),
  cargo: z
    .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) }),
  telefono: z
    .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
    .trim()
    .regex(TELEFONO_RE, { error: t(K.VALIDATION.INVALID_PHONE) }),
  rama: z.enum(RAMAS).optional(),
  groupId: z.number().int().positive().optional(),
  districtId: z.number().int().positive().optional(),
});

export type CrearSolicitudDto = z.infer<typeof crearSolicitudSchema>;
