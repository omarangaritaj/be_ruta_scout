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

  SISCOUT_API_URL: z.url({ error: 'debe ser una URL válida' }).optional(),

  SISCOUT_API_KEY: z.string().min(1).optional(),

  SISCOUT_BATCH_SIZE: z.coerce
    .number({ error: 'debe ser un número' })
    .int({ error: 'debe ser un número entero' })
    .min(1, { error: 'debe estar entre 1 y 1000' })
    .max(1000, { error: 'debe estar entre 1 y 1000' })
    .default(200),

  SISCOUT_SYNC_CRON: z.string().min(1).default('0 3 * * *'),

  SISCOUT_SYNC_ENABLED: z
    .enum(['true', 'false'], { error: 'debe ser true o false' })
    .default('false')
    .transform((valor) => valor === 'true'),
});

/** Tipo derivado del esquema: ya con las conversiones aplicadas (PORT es number). */
export type Env = z.infer<typeof envSchema>;
