import { envSchema, type Env } from './env.schema';

/** Serializa de forma segura el valor recibido para mostrarlo en el error. */
function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Valida y transforma las variables de entorno al arrancar la aplicación.
 *
 * Usa `safeParse` para recolectar TODOS los errores de una sola pasada: si
 * faltan tres variables, el desarrollador las ve las tres, no una por arranque.
 *
 * Si la validación falla se lanza una excepción y NestJS aborta el arranque.
 * Es deliberado: preferimos no levantar a levantar con configuración inválida.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (result.success) {
    return result.data;
  }

  const missing: string[] = [];
  const invalid: string[] = [];

  for (const issue of result.error.issues) {
    const variable = issue.path.join('.');
    const value = config[variable];

    if (value === undefined) {
      missing.push(`  • ${variable}`);
    } else {
      invalid.push(
        `  • ${variable}: ${issue.message} (recibido: "${formatValue(value)}")`,
      );
    }
  }

  const message: string[] = [
    '',
    '════════════════════════════════════════════════════════════',
    ' CONFIGURACIÓN DE ENTORNO INVÁLIDA — la aplicación no arranca',
    '════════════════════════════════════════════════════════════',
  ];

  if (missing.length > 0) {
    message.push(
      '',
      'Variables requeridas que NO están definidas:',
      ...missing,
    );
  }

  if (invalid.length > 0) {
    message.push('', 'Variables definidas con un valor inválido:', ...invalid);
  }

  message.push(
    '',
    'Revisa tu archivo .env (puedes partir de .env.example).',
    '════════════════════════════════════════════════════════════',
    '',
  );

  throw new Error(message.join('\n'));
}
