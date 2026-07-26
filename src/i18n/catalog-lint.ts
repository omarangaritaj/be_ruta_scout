import { CATALOG } from './catalog';
import { t, type MessageKey, type MessageParams } from './messages';

/**
 * Validación del catálogo, compartida por `pnpm i18n:check` y por los tests.
 *
 * Comprueba la PLANTILLA además de la salida: una llave sin cerrar no deja
 * rastro en el texto renderizado —el motor se come desde `{` hasta el final y
 * lo sustituye por el parámetro— así que mirar solo el resultado da un falso
 * OK mientras el mensaje pierde su cola en producción.
 */
export interface CatalogProblem {
  key: MessageKey;
  detail: string;
}

function braceProblem(template: string): string | null {
  let level = 0;
  for (const char of template) {
    if (char === '{') level += 1;
    else if (char === '}') {
      level -= 1;
      if (level < 0) return 'llave de cierre "}" sin abrir';
    }
  }
  return level > 0 ? 'llave "{" sin cerrar' : null;
}

function syntheticParams(template: string): MessageParams {
  const re = /\{\s*(\w+)\s*(?:,\s*(number|plural|select|selectordinal)\b)?/g;
  const params: MessageParams = {};
  let match = re.exec(template);
  while (match) {
    const [, name, type] = match;
    params[name] = type === 'number' ? 1234 : type === 'plural' ? 2 : 'X';
    match = re.exec(template);
  }
  return params;
}

export function findCatalogProblems(): CatalogProblem[] {
  const problems: CatalogProblem[] = [];

  for (const [domain, group] of Object.entries(CATALOG)) {
    for (const [name, template] of Object.entries(
      group as Record<string, string>,
    )) {
      const key = `${domain}.${name}` as MessageKey;

      const braces = braceProblem(template);
      if (braces) {
        problems.push({
          key,
          detail: `${braces} → ${JSON.stringify(template)}`,
        });
        continue;
      }

      try {
        const output = t(key, syntheticParams(template));
        if (/[{}]/.test(output)) {
          problems.push({
            key,
            detail: `placeholder sin resolver → ${JSON.stringify(output)}`,
          });
        }
      } catch (error) {
        problems.push({
          key,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return problems;
}

export function countCatalogMessages(): number {
  return Object.values(CATALOG).reduce(
    (total, group) => total + Object.keys(group).length,
    0,
  );
}
