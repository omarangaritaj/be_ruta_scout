import { validateCronExpression } from 'cron';
import { z } from 'zod';

const zoneIds = z
  .array(z.number().int().positive({ error: 'debe ser un entero positivo' }))
  .min(1, { error: 'debe incluir al menos una zona' })
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
    error: 'no es una expresión cron válida',
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
    error: 'debe incluir al menos un campo a modificar',
  });

export type UpdateSiscoutConfigDto = z.infer<typeof updateSiscoutConfigSchema>;
