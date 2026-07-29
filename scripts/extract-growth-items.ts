import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BRANCHES,
  GROWTH_AREAS,
  growthAreasOf,
  type Branch,
  type GrowthArea,
} from '../src/domain';

const ROOT = join(__dirname, '..');
const LEGACY = join(
  ROOT,
  '..',
  'fe_ruta',
  'docs',
  'referencia',
  'entorno-programa-v0.6.2.html',
);
const OUTPUT = join(ROOT, 'src', 'seeds', 'data', 'growth-items.json');

interface LegacyArea {
  area: string;
  items: string[];
}

interface SeedItem {
  branch: Branch;
  growthArea: GrowthArea;
  order: number;
  text: string;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function asBranch(unit: string): Branch {
  const candidate = normalize(unit);
  const branch = BRANCHES.find((value) => value === candidate);
  if (!branch) throw new Error(`Rama desconocida en el legado: ${unit}`);
  return branch;
}

function asGrowthArea(area: string): GrowthArea {
  const candidate = normalize(area);
  const growthArea = GROWTH_AREAS.find((value) => value === candidate);
  if (!growthArea) throw new Error(`Área desconocida en el legado: ${area}`);
  return growthArea;
}

function readAreas(source: string, from: number): LegacyArea[] {
  let depth = 0;
  let insideString = false;
  let escaped = false;
  for (let i = from; i < source.length; i += 1) {
    const char = source[i];
    if (insideString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') insideString = false;
      continue;
    }
    if (char === '"') insideString = true;
    else if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(source.slice(from, i + 1)) as LegacyArea[];
      }
    }
  }
  throw new Error('El bloque de áreas no cierra');
}

function extract(source: string): SeedItem[] {
  const pattern = /"unit":\s*"(\w+)"[^{]*?"mode":\s*"\w+",\s*"areas":\s*\[/g;
  const areasByBranch = new Map<Branch, LegacyArea[]>();

  for (const match of source.matchAll(pattern)) {
    const branch = asBranch(match[1]);
    const areas = readAreas(source, match.index + match[0].length - 1);
    areasByBranch.set(branch, areas);
  }

  if (areasByBranch.size !== BRANCHES.length) {
    throw new Error(
      `Faltan ramas: se extrajeron ${areasByBranch.size} de ${BRANCHES.length}`,
    );
  }

  const items: SeedItem[] = [];
  for (const branch of BRANCHES) {
    const areas = areasByBranch.get(branch);
    if (!areas) throw new Error(`Falta la rama ${branch} en el legado`);

    for (const area of areas) {
      const growthArea = asGrowthArea(area.area);
      if (!growthAreasOf(branch).includes(growthArea)) {
        throw new Error(`${growthArea} no corresponde a la rama ${branch}`);
      }
      area.items.forEach((text, index) => {
        items.push({ branch, growthArea, order: index + 1, text: text.trim() });
      });
    }
  }
  return items;
}

const items = extract(readFileSync(LEGACY, 'utf8'));
writeFileSync(OUTPUT, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
console.log(`✔ ${items.length} items escritos en ${OUTPUT}`);
