import { z } from 'zod';

/**
 * Única fuente de verdad de las variables de entorno de la aplicación.
 *
 * Toda variable nueva se declara AQUÍ. Fuera de este módulo nunca se lee
 * `process.env` directamente: se inyecta `AppConfigService` y se accede
 * de forma tipada.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'], {
      error: 'debe ser uno de: development, production, test',
    })
    .default('development'),

  PORT: z.coerce
    .number({ error: 'debe ser un número' })
    .int({ error: 'debe ser un número entero' })
    .min(1, { error: 'debe estar entre 1 y 65535' })
    .max(65535, { error: 'debe estar entre 1 y 65535' })
    .default(3000),

  MONGODB_URI: z
    .string({ error: 'debe ser una cadena de texto' })
    .regex(/^mongodb(\+srv)?:\/\/.+/, {
      error:
        'debe ser una URI de MongoDB válida (mongodb://… o mongodb+srv://…)',
    }),

  // --- Sincronización con SiScout ---
  // Opcionales a propósito: sin ellas la aplicación arranca igual y la
  // sincronización queda deshabilitada, lo que permite trabajar en local
  // sin depender del servicio externo.

  SISCOUT_BASE_URL: z.url({ error: 'debe ser una URL válida' }).optional(),

  SISCOUT_MASTER_USER: z.string().min(1).optional(),

  SISCOUT_MASTER_PASSWORD: z.string().min(1).optional(),

  // Ruta que activa el rol con acceso nacional, p. ej.
  // /users/change-rol/826/176035/7
  SISCOUT_CHANGE_ROL_PATH: z.string().min(1).optional(),

  // Zonas a descargar, separadas por coma. "1" es Colombia entera.
  SISCOUT_ZONE_IDS: z
    .string()
    .default('1')
    .transform((value) => [
      ...new Set(
        value
          .split(',')
          .map((parte) => parseInt(parte.trim(), 10))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    ])
    .refine((ids) => ids.length > 0, {
      error:
        'debe producir al menos una zona (enteros positivos separados por coma)',
    }),

  // Tamaño de página de la descarga (parámetro `length` de DataTables).
  SISCOUT_PAGE_LENGTH: z.coerce
    .number({ error: 'debe ser un número' })
    .int()
    .min(1)
    .max(10000)
    .default(4000),

  // Techo de páginas por zona: capacidad = PAGE_LENGTH * MAX_PAGINAS.
  SISCOUT_MAX_PAGINAS: z.coerce
    .number({ error: 'debe ser un número' })
    .int()
    .min(1)
    .max(100)
    .default(3),

  // Mínimo de registros esperado en la zona principal. Un total menor delata
  // que el rol nacional no quedó activo, y seguir marcaría huérfano a media base.
  SISCOUT_MIN_REGISTROS_ZONA_PRINCIPAL: z.coerce
    .number({ error: 'debe ser un número' })
    .int()
    .min(0)
    .default(1000),

  // Tamaño de los lotes de escritura en Mongo.
  SISCOUT_CHUNK_ESCRITURA: z.coerce
    .number({ error: 'debe ser un número' })
    .int()
    .min(1)
    .max(5000)
    .default(500),

  SISCOUT_SYNC_CRON: z.string().min(1).default('0 3 * * *'),

  SISCOUT_SYNC_ENABLED: z
    .enum(['true', 'false'], { error: 'debe ser true o false' })
    .default('false')
    .transform((value) => value === 'true'),
});

/** Tipo derivado del esquema: ya con las conversiones aplicadas (PORT es number). */
export type Env = z.infer<typeof envSchema>;
