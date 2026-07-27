import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT, renderAll } from './domain-render';

async function main(): Promise<void> {
  const archivos = await renderAll();
  for (const [ruta, contenido] of archivos) {
    const destino = join(ROOT, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, contenido, 'utf8');
  }
  console.log(`domain:gen OK - ${archivos.size} archivo(s) generado(s)`);
}

void main();
