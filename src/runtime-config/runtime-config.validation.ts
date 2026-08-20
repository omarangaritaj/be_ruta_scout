import { validateCronExpression } from 'cron';
import { z } from 'zod';
import { K, t } from '../i18n';
import type {
  RuntimeConfigConstraints,
  RuntimeConfigType,
} from './runtime-config.types';

/**
 * Construye el validador de un ajuste A PARTIR DE SUS PROPIOS DATOS.
 *
 * Aquí está la diferencia con el esquema estático que había antes. Aquel sabía
 * de memoria que `pageLength` llegaba hasta 10000, así que cada clave nueva
 * exigía programar su regla. Este no conoce ninguna clave: recibe el tipo y los
 * límites que trae el registro y arma el validador en el momento. Añadir una
 * configuración deja de tocar este archivo.
 *
 * La validación NO es opcional por ser dinámica: sin ella el panel aceptaría
 * `maxPages: 999999` y la sincronización intentaría descargar esas páginas.
 */
export function buildValueSchema(
  type: RuntimeConfigType,
  constraints: RuntimeConfigConstraints = {},
): z.ZodType {
  switch (type) {
    case 'boolean':
      return z.boolean();

    case 'number':
      return numberSchema(constraints);

    case 'string':
      return stringSchema(constraints);

    case 'cron':
      return z
        .string()
        .trim()
        .min(1)
        .refine((expr) => validateCronExpression(expr).valid, {
          error: t(K.VALIDATION.INVALID_CRON),
        });

    case 'number[]':
      return arraySchema(numberSchema(constraints), constraints);

    case 'string[]':
      return arraySchema(stringSchema(constraints), constraints);

    case 'select':
      return selectSchema(constraints);
  }
}

function numberSchema(
  constraints: RuntimeConfigConstraints,
): z.ZodType<number> {
  let schema = z.number();
  if (constraints.integer) schema = schema.int();
  if (constraints.min !== undefined) schema = schema.min(constraints.min);
  if (constraints.max !== undefined) schema = schema.max(constraints.max);
  return schema;
}

function stringSchema(
  constraints: RuntimeConfigConstraints,
): z.ZodType<string> {
  let schema = z.string().trim();
  if (constraints.pattern !== undefined) {
    schema = schema.regex(new RegExp(constraints.pattern));
  }
  if (constraints.min !== undefined) schema = schema.min(constraints.min);
  if (constraints.max !== undefined) schema = schema.max(constraints.max);
  return schema;
}

function arraySchema(
  element: z.ZodType,
  constraints: RuntimeConfigConstraints,
): z.ZodType {
  let schema = z.array(element);
  if (constraints.minItems !== undefined) {
    schema = schema.min(constraints.minItems);
  }
  if (constraints.maxItems !== undefined) {
    schema = schema.max(constraints.maxItems);
  }
  return constraints.unique
    ? schema.transform((items: unknown[]) => [...new Set(items)])
    : schema;
}

/**
 * Opciones cerradas. Se comparan contra los valores declarados en el registro,
 * no contra una unión de literales de TypeScript: las opciones son datos y solo
 * se conocen en tiempo de ejecución.
 */
function selectSchema(constraints: RuntimeConfigConstraints): z.ZodType {
  const permitidos = (constraints.options ?? []).map((option) => option.value);
  return z
    .union([z.string(), z.number()])
    .refine((valor) => permitidos.includes(valor), {
      error: t(K.VALIDATION.INVALID_OPTION),
    });
}
