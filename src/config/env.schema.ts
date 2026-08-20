import { z } from 'zod';
// Se importa el módulo concreto y no el barril de `crypto`: ese barril arrastra
// `CryptoModule`, que a su vez importa este esquema, y el ciclo rompería la
// carga.
import { isValidKeyring } from '../crypto/keyring';

/**
 * Hace una variable opcional tratando la cadena VACÍA como ausente.
 *
 * En un `.env` es habitual declarar una variable opcional vacía
 * (`SISCOUT_BASE_URL=`) como marcador para rellenarla luego. Zod entrega esa
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

/**
 * Valida un conjunto de claves de cifrado.
 *
 * Admite una clave suelta (`<base64>`) o varias con identificador
 * (`v2:<base64>,v1:<base64>`), donde la primera es la que cifra y las demás
 * siguen abriendo lo escrito antes de rotar. Ver `src/crypto/keyring.ts`.
 */
const keyringEnv = z.string().refine(isValidKeyring, {
  error:
    'debe ser una clave de 32 bytes (base64 de 44 o hex de 64 caracteres), ' +
    'o varias en formato «v2:clave,v1:clave» con la activa primero',
});

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

  // Orígenes permitidos para CORS y socket.io, separados por coma. En v2 el
  // navegador habla directo con este backend (el FE es una PWA client-only,
  // ya no existe el BFF de Next del sistema anterior).
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3001')
    .transform((valor) =>
      valor
        .split(',')
        .map((origen) => origen.trim())
        .filter(Boolean),
    ),

  // Conexión principal a PostgreSQL. En desarrollo, el Postgres local del
  // docker compose; en producción puede ser directamente Supabase.
  DATABASE_URL: z
    .string({ error: 'debe ser una cadena de texto' })
    .regex(/^postgres(ql)?:\/\/.+/, {
      error:
        'debe ser una URI de PostgreSQL válida (postgres://… o postgresql://…)',
    }),

  // Conexión remota a Supabase (réplica / lecturas remotas / migración).
  // Opcional a propósito: sin ella la aplicación opera solo con DATABASE_URL.
  SUPABASE_DATABASE_URL: optionalEnv(
    z.string().regex(/^postgres(ql)?:\/\/.+/, {
      error:
        'debe ser una URI de PostgreSQL válida (postgres://… o postgresql://…)',
    }),
  ),

  // Conexión al Redis local que respalda el cache en memoria (perfil/permisos).
  // Tiene default para arrancar sin configurar nada; y si el servicio no
  // responde, el cache degrada con gracia (miss → se recomputa), así que la
  // aplicación opera igual sin Redis.
  REDIS_URL: z
    .string({ error: 'debe ser una cadena de texto' })
    .regex(/^rediss?:\/\/.+/, {
      error: 'debe ser una URL de Redis válida (redis://… o rediss://…)',
    })
    .default('redis://localhost:6379'),

  // --- Sincronización con SiScout ---
  // Opcionales a propósito: sin ellas la aplicación arranca igual y la
  // sincronización queda deshabilitada, lo que permite trabajar en local
  // sin depender del servicio externo.

  SISCOUT_BASE_URL: optionalEnv(z.url({ error: 'debe ser una URL válida' })),

  // --- Claves de cifrado ---
  // Nunca van a la base de datos ni se editan en caliente: un secreto que la
  // aplicación pueda reescribir por su cuenta deja de ser un secreto.
  // Generar con: openssl rand -base64 32

  // Cifra los campos sensibles del snapshot en reposo (cédula, teléfono,
  // correo).
  SISCOUT_ENCRYPTION_KEY: optionalEnv(keyringEnv),

  // Cifra las contraseñas del pool de credenciales. DISTINTA de la anterior a
  // propósito: son dominios con riesgos y ritmos de rotación diferentes, y
  // filtrar una no debe comprometer la otra.
  SISCOUT_CREDENTIALS_KEY: optionalEnv(keyringEnv),

  // Clave del HMAC que permite buscar por cédula sin descifrarla. No cifra:
  // filtrarla no revela cédulas, solo permite comprobar si una está presente.
  CEDULA_HASH_KEY: optionalEnv(keyringEnv),

  // Firma los access tokens (JWT). Los refresh tokens son opacos y no la usan.
  JWT_SECRET: z.string().min(16),
  // Vida del access token EN SEGUNDOS. También es el TTL del cache de perfil
  // (`current_user:*`) en Redis: la sesión y su cache expiran a la vez.
  JWT_ACCESS_TTL_SECONDS: z.coerce
    .number({ error: 'debe ser un número' })
    .int({ error: 'debe ser un número entero' })
    .positive({ error: 'debe ser mayor que 0' })
    .default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).default(30),

  // Vida del enlace de recuperación de contraseña. Corta a propósito: el enlace
  // viaja a un buzón, y cualquiera con acceso a ese buzón puede usarlo.
  PASSWORD_RESET_TTL_MINUTES: z.coerce
    .number({ error: 'debe ser un número' })
    .int({ error: 'debe ser un número entero' })
    .min(5, { error: 'debe estar entre 5 y 1440' })
    .max(1440, { error: 'debe estar entre 5 y 1440' })
    .default(30),

  // Bootstrap del super admin (seed de un solo uso). Opcionales y descartables:
  // si se omiten, el seed usa sus valores por defecto.
  CEDULA_SUPER_ADMIN: optionalEnv(z.string().trim()),
  PASSWORD_SUPER_ADMIN: optionalEnv(z.string()),

  // Correo transaccional (Resend). Sin ambas, el envío queda inerte (no falla).
  RESEND_API_KEY: optionalEnv(z.string()),
  EMAIL_FROM: optionalEnv(z.string()),
  // URL pública del sitio, para los enlaces y logos de los correos.
  SITE_URL: z.string().url().default('https://ruta.scout.org.co'),
});

/** Tipo derivado del esquema: ya con las conversiones aplicadas (PORT es number). */
export type Env = z.infer<typeof envSchema>;
