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

  // Las CREDENCIALES no están aquí: usuario, contraseña y ruta de cambio de
  // rol viven en la colección `siscout_credentials`, editables en caliente y
  // con la contraseña cifrada. Cada credencial trae la suya, porque cada perfil
  // de acceso activa una ruta distinta. Ver `src/siscout/credentials`.

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

  // Los ajustes operativos de la sincronización (zonas, tamaños de página y de
  // lote, cron e interruptor) NO viven aquí: son configuración editable en
  // tiempo de ejecución, en la colección `siscout_config`. Ver
  // `src/siscout/config`. En el entorno solo quedan los secretos y la conexión.
});

/** Tipo derivado del esquema: ya con las conversiones aplicadas (PORT es number). */
export type Env = z.infer<typeof envSchema>;
