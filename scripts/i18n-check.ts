// Verifica que el motor de i18n renderice TODAS las entradas del catálogo sin
// dejar placeholders sin resolver. Guarda contra plantillas que el motor propio
// no soporte (una llave sin cerrar, un typo, un constructo ICU no cubierto):
// varios t() corren dentro de plantillas de correo y filtros globales, así que
// un fallo tumbaría la respuesta en caliente. Este check lo adelanta a CI.
import { CATALOG } from '../src/i18n/catalog';
import { t, type MessageKey } from '../src/i18n/messages';

type Params = Record<string, string | number>;

function syntheticParams(template: string): Params {
  const re = /\{\s*(\w+)\s*(?:,\s*(number|plural|select|selectordinal)\b)?/g;
  const params: Params = {};
  let match = re.exec(template);
  while (match) {
    const [, name, type] = match;
    params[name] = type === 'number' ? 1234 : type === 'plural' ? 2 : 'X';
    match = re.exec(template);
  }
  return params;
}

const failures: string[] = [];
let total = 0;

for (const [domain, group] of Object.entries(CATALOG)) {
  for (const [key, template] of Object.entries(
    group as Record<string, string>,
  )) {
    total += 1;
    const messageKey = `${domain}.${key}` as MessageKey;
    try {
      const output = t(messageKey, syntheticParams(template));
      if (/[{}]/.test(output)) {
        failures.push(
          `${messageKey}: placeholder sin resolver → ${JSON.stringify(output)}`,
        );
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push(`${messageKey}: ${detail}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length} mensaje(s) con problema:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`i18n OK — ${total} mensajes renderizan en es-CO`);
