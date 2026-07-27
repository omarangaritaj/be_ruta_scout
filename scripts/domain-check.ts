import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MANIFEST_PATH, ROOT, renderAll } from './domain-render';

const SIBLING = join(ROOT, '..', 'fe_ruta', 'domain-manifest.json');

function hash(contenido: string): string {
  return createHash('sha256').update(contenido).digest('hex');
}

async function main(): Promise<void> {
  const fallos: string[] = [];

  for (const [ruta, esperado] of await renderAll()) {
    const destino = join(ROOT, ruta);
    if (!existsSync(destino)) {
      fallos.push(`${ruta}: no existe. Corre pnpm domain:gen`);
      continue;
    }
    if (readFileSync(destino, 'utf8') !== esperado) {
      fallos.push(`${ruta}: difiere del manifiesto. Corre pnpm domain:gen`);
    }
  }

  const propio = hash(readFileSync(MANIFEST_PATH, 'utf8'));
  if (existsSync(SIBLING)) {
    const hermano = hash(readFileSync(SIBLING, 'utf8'));
    if (propio !== hermano) {
      fallos.push(
        `paridad: domain-manifest.json difiere de fe_ruta (${propio.slice(0, 12)} vs ${hermano.slice(0, 12)})`,
      );
    }
  } else {
    console.warn(
      `domain:check - sin manifiesto en ${SIBLING}: paridad cruzada NO verificada`,
    );
  }

  if (fallos.length > 0) {
    console.error(`✗ ${fallos.length} problema(s) de dominio:`);
    for (const fallo of fallos) console.error(`  - ${fallo}`);
    process.exit(1);
  }

  console.log(`domain:check OK - manifiesto ${propio.slice(0, 12)}`);
}

void main();
