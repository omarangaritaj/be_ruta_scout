import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { generateFiles, readManifest } from './domain-codegen';

export const ROOT = join(__dirname, '..');
export const MANIFEST_PATH = join(ROOT, 'domain-manifest.json');

export async function renderAll(): Promise<Map<string, string>> {
  const manifest = readManifest(readFileSync(MANIFEST_PATH, 'utf8'));
  const config = await resolveConfig(MANIFEST_PATH);
  const salida = new Map<string, string>();
  for (const [ruta, contenido] of generateFiles(manifest)) {
    const parser = ruta.endsWith('.json') ? 'json' : 'typescript';
    salida.set(ruta, await format(contenido, { ...config, parser }));
  }
  return salida;
}
