import { validateCronExpression } from 'cron';
import { z } from 'zod';
import { K, t } from '../../../i18n';

const zoneIds = z
  .array(
    z
      .number()
      .int()
      .positive({ error: t(K.VALIDATION.POSITIVE_INTEGER) }),
  )
  .min(1, { error: t(K.VALIDATION.AT_LEAST_ONE_ZONE) })
  .transform((ids) => [...new Set(ids)]);

const pageLength = z.number().int().min(1).max(10000);
const maxPages = z.number().int().min(1).max(100);
const minMainZoneRecords = z.number().int().min(0);
const writeChunkSize = z.number().int().min(1).max(5000);

const syncCron = z
  .string()
  .trim()
  .min(1)
  .refine((expr) => validateCronExpression(expr).valid, {
    error: t(K.VALIDATION.INVALID_CRON),
  });

const syncEnabled = z.boolean();

/**
 * Todos los campos opcionales: se actualiza solo lo que llega. Se exige al
 * menos uno para no aceptar un PATCH que no hace nada.
 */
export const updateSiscoutConfigSchema = z
  .object({
    zoneIds,
    pageLength,
    maxPages,
    minMainZoneRecords,
    writeChunkSize,
    syncCron,
    syncEnabled,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: t(K.VALIDATION.AT_LEAST_ONE_FIELD),
  });

export type UpdateSiscoutConfigDto = z.infer<typeof updateSiscoutConfigSchema>;
