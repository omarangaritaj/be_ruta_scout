import { z } from 'zod';
import { K, t } from '../../i18n';
import { toMidnightUTC } from '../event-dates';

/**
 * Solo fechas. Soltar una tarjeta no debe mandar el formulario entero: este
 * endpoint tiene su propia validación acotada y su propio contrato de
 * conflictos.
 *
 * Normaliza a medianoche UTC igual que el alta: es la otra puerta por la que
 * entra una fecha, y la invariante no admite excepciones.
 */
export const rescheduleSchema = z
  .object({
    startDate: z.coerce.date().transform(toMidnightUTC),
    endDate: z.coerce.date().transform(toMidnightUTC),
  })
  .refine((data) => data.endDate.getTime() >= data.startDate.getTime(), {
    error: t(K.EVENTS.INVALID_DATE_RANGE),
    path: ['endDate'],
  });

export type RescheduleDto = z.infer<typeof rescheduleSchema>;
