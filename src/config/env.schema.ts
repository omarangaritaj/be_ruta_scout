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
});

/** Tipo derivado del esquema: ya con las conversiones aplicadas (PORT es number). */
export type Env = z.infer<typeof envSchema>;
