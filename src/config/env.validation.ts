import { envSchema, type Env } from './env.schema';

/** Serializa de forma segura el valor recibido para mostrarlo en el error. */
function formatearValor(valor: unknown): string {
  return typeof valor === 'string' ? valor : JSON.stringify(valor);
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
  const resultado = envSchema.safeParse(config);

  if (resultado.success) {
    return resultado.data;
  }

  const faltantes: string[] = [];
  const invalidas: string[] = [];

  for (const issue of resultado.error.issues) {
    const variable = issue.path.join('.');
    const valor = config[variable];

    if (valor === undefined) {
      faltantes.push(`  • ${variable}`);
    } else {
      invalidas.push(
        `  • ${variable}: ${issue.message} (recibido: "${formatearValor(valor)}")`,
      );
    }
  }

  const mensaje: string[] = [
    '',
    '════════════════════════════════════════════════════════════',
    ' CONFIGURACIÓN DE ENTORNO INVÁLIDA — la aplicación no arranca',
    '════════════════════════════════════════════════════════════',
  ];

  if (faltantes.length > 0) {
    mensaje.push(
      '',
      'Variables requeridas que NO están definidas:',
      ...faltantes,
    );
  }

  if (invalidas.length > 0) {
    mensaje.push(
      '',
      'Variables definidas con un valor inválido:',
      ...invalidas,
    );
  }

  mensaje.push(
    '',
    'Revisa tu archivo .env (puedes partir de .env.example).',
    '════════════════════════════════════════════════════════════',
    '',
  );

  throw new Error(mensaje.join('\n'));
}
