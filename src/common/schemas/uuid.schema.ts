import { z } from 'zod';
import { K, t } from '../../i18n';

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Valida un identificador UUID recibido como string. Sustituye al
 * objectIdSchema del sistema anterior; a diferencia de aquel no transforma el
 * valor: en Postgres el uuid viaja como string.
 */
export const uuidSchema = z
  .string({ error: t(K.VALIDATION.MUST_BE_STRING) })
  .regex(UUID_PATTERN, {
    error: t(K.VALIDATION.UUID),
  });
