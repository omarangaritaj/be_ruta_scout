import { z } from 'zod';

/**
 * Hace una variable opcional tratando la cadena VACÍA como ausente.
 *
 * En un `.env` es habitual declarar una variable opcional vacía
 * (`SISCOUT_MASTER_USER=`) como marcador para rellenarla luego. Zod entrega esa
 * variable como `""`, que NO es `undefined`, así que `.optional()` no basta y la
 * validación fallaría. Aquí se normaliza `""` (y solo espacios) a `undefined`
 * antes de validar, de modo que una opcional vacía se interpreta como sin
 * configurar y la aplicación arranca igual.
 */
function optionalEnv<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (valor) =>
      typeof valor === 'string' && valor.trim() === '' ? undefined : valor,
    schema.optional(),
  );
}

/** Longitud en bytes de una clave dada en base64 o hex; -1 si no decodifica. */
function decodeKeyLength(valor: string): number {
  if (/^[0-9a-fA-F]+$/.test(valor) && valor.length % 2 === 0) {
    return valor.length / 2;
  }
  try {
    return Buffer.from(valor, 'base64').length;
  } catch {
    return -1;
  }
}

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

  SISCOUT_BASE_URL: optionalEnv(z.url({ error: 'debe ser una URL válida' })),

  SISCOUT_MASTER_USER: optionalEnv(z.string().min(1)),

  SISCOUT_MASTER_PASSWORD: optionalEnv(z.string().min(1)),

  // Ruta que activa el rol con acceso nacional, p. ej.
  // /users/change-rol/826/176035/7
  SISCOUT_CHANGE_ROL_PATH: optionalEnv(z.string().min(1)),

  // Clave AES-256 para cifrar los campos sensibles del snapshot en reposo.
  // 32 bytes en base64 (44 caracteres) o en hex (64 caracteres).
  // Generar con: openssl rand -base64 32
  SISCOUT_ENCRYPTION_KEY: optionalEnv(
    z.string().refine((valor) => decodeKeyLength(valor) === 32, {
      error:
        'debe decodificar a 32 bytes (base64 de 44 o hex de 64 caracteres)',
    }),
  ),

  // Los ajustes operativos de la sincronización (zonas, tamaños de página y de
  // lote, cron e interruptor) NO viven aquí: son configuración editable en
  // tiempo de ejecución, en la colección `siscout_config`. Ver
  // `src/siscout/config`. En el entorno solo quedan los secretos y la conexión.
});

/** Tipo derivado del esquema: ya con las conversiones aplicadas (PORT es number). */
export type Env = z.infer<typeof envSchema>;
