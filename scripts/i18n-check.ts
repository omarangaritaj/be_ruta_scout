// Verifica que TODAS las entradas del catálogo sean plantillas válidas y
// rendericen sin dejar placeholders sin resolver. Guarda contra una llave sin
// cerrar, un typo o un constructo ICU que el motor propio no soporte: varios
// t() corren dentro de plantillas de correo y del filtro global, así que un
// fallo tumbaría la respuesta en caliente. Este check lo adelanta al build.
import {
  countCatalogMessages,
  findCatalogProblems,
} from '../src/i18n/catalog-lint';

const problems = findCatalogProblems();

if (problems.length > 0) {
  console.error(`✗ ${problems.length} mensaje(s) con problema:`);
  for (const { key, detail } of problems) {
    console.error(`  - ${key}: ${detail}`);
  }
  process.exit(1);
}

console.log(`i18n OK — ${countCatalogMessages()} mensajes renderizan en es-CO`);
