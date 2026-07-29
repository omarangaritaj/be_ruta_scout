export interface NamedValue {
  name: string;
  value: string;
}

export interface BranchEntry extends NamedValue {
  order: number;
  siscoutAliases: string[];
  /** `[min, max]` de edad, ambos inclusive. Ver `assertAgeRanges`. */
  ageRange: [number, number];
  growthAreas: string[];
}

export interface PermissionEntry {
  key: string;
  side: 'be' | 'fe' | 'both';
}

export interface RouteResourceEntry {
  path: string;
  label: string;
  section?: string;
  always?: boolean;
}

export interface DomainManifest {
  version: number;
  branches: BranchEntry[];
  accessStates: NamedValue[];
  requestStates: NamedValue[];
  accessLevels: NamedValue[];
  roleLevels: NamedValue[];
  personTypes: NamedValue[];
  unitRoles: NamedValue[];
  diagnosticBlocks: NamedValue[];
  growthAreas: NamedValue[];
  permissions: PermissionEntry[];
  routeResources: RouteResourceEntry[];
  apiErrorCodes: NamedValue[];
}

const HEADER =
  '// GENERADO por `pnpm domain:gen` desde domain-manifest.json. No editar a mano.\n\n';

function assertUnique(entries: NamedValue[], grupo: string): void {
  const vistos = new Set<string>();
  for (const { value } of entries) {
    if (vistos.has(value)) {
      throw new Error(`Valor duplicado en ${grupo}: ${value}`);
    }
    vistos.add(value);
  }
}

function assertUniqueRoutePaths(
  entries: RouteResourceEntry[],
  grupo: string,
): void {
  const vistos = new Set<string>();
  for (const { path } of entries) {
    if (vistos.has(path)) {
      throw new Error(`Valor duplicado en ${grupo}: ${path}`);
    }
    vistos.add(path);
  }
}

/**
 * Los tramos de edad tienen que cubrir la progresión SIN huecos ni solapes: de
 * ellos sale la rama de un protagonista cuyo cargo de SiScout no es legible, y
 * un hueco lo dejaría fuera de toda unidad justo como si no hubiera respaldo.
 * Se validan aquí, en el manifiesto, porque es la única fuente de la verdad.
 */
function assertAgeRanges(branches: BranchEntry[]): void {
  let previo: number | undefined;
  for (const { value, ageRange } of branches) {
    const [min, max] = ageRange ?? [];
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error(`Rango de edad no entero en branches: ${value}`);
    }
    if (min > max) {
      throw new Error(`Rango de edad invertido en branches: ${value}`);
    }
    if (previo !== undefined && min !== previo + 1) {
      throw new Error(
        `Rango de edad discontinuo en branches: ${value} empieza en ${min}, ` +
          `se esperaba ${previo + 1}`,
      );
    }
    previo = max;
  }
}

function assertBranchGrowthAreas(
  branches: BranchEntry[],
  growthAreas: NamedValue[],
): void {
  const validas = new Set(growthAreas.map((a) => a.value));
  for (const { value, growthAreas: areas } of branches) {
    if (!areas || areas.length === 0) {
      throw new Error(`Rama sin áreas de crecimiento: ${value}`);
    }
    const vistas = new Set<string>();
    for (const area of areas) {
      if (!validas.has(area)) {
        throw new Error(`Área de crecimiento inexistente en ${value}: ${area}`);
      }
      if (vistas.has(area)) {
        throw new Error(`Área de crecimiento repetida en ${value}: ${area}`);
      }
      vistas.add(area);
    }
  }
}

export function readManifest(raw: string): DomainManifest {
  const manifest = JSON.parse(raw) as DomainManifest;
  const branches = [...manifest.branches].sort((a, b) => a.order - b.order);
  const ordenado = { ...manifest, branches };
  assertUnique(ordenado.branches, 'branches');
  assertAgeRanges(ordenado.branches);
  assertUnique(ordenado.accessStates, 'accessStates');
  assertUnique(ordenado.requestStates, 'requestStates');
  assertUnique(ordenado.accessLevels, 'accessLevels');
  assertUnique(ordenado.roleLevels, 'roleLevels');
  assertUnique(ordenado.personTypes, 'personTypes');
  assertUnique(ordenado.unitRoles, 'unitRoles');
  assertUnique(ordenado.diagnosticBlocks, 'diagnosticBlocks');
  assertUnique(ordenado.growthAreas, 'growthAreas');
  assertBranchGrowthAreas(ordenado.branches, ordenado.growthAreas);
  assertUnique(ordenado.apiErrorCodes, 'apiErrorCodes');
  assertUniqueRoutePaths(ordenado.routeResources, 'routeResources');
  return ordenado;
}

function quoted(values: string[]): string {
  return values.map((v) => `'${v}'`).join(', ');
}

function constAndType(
  constName: string,
  typeName: string,
  entries: NamedValue[],
): string {
  return (
    `export const ${constName} = [${quoted(entries.map((e) => e.value))}] as const;\n` +
    `export type ${typeName} = (typeof ${constName})[number];\n`
  );
}

function aliasMap(branches: BranchEntry[]): string {
  const filas = branches
    .flatMap((b) =>
      b.siscoutAliases.map((alias) => `  '${alias}': '${b.value}',`),
    )
    .join('\n');
  return (
    '\nexport const BRANCH_SISCOUT_ALIASES: Record<string, Branch> = {\n' +
    `${filas}\n};\n`
  );
}

function ageRangeMap(branches: BranchEntry[]): string {
  const filas = branches
    .map(
      (b) =>
        `  { branch: '${b.value}', min: ${b.ageRange[0]}, max: ${b.ageRange[1]} },`,
    )
    .join('\n');
  const ultima = branches[branches.length - 1];
  return (
    '\nexport interface BranchAgeRange {\n' +
    '  branch: Branch;\n' +
    '  min: number;\n' +
    '  max: number;\n' +
    '}\n' +
    '\n/** Tramos de edad de la progresión, contiguos y ambos extremos inclusive. */\n' +
    'export const BRANCH_AGE_RANGES: readonly BranchAgeRange[] = [\n' +
    `${filas}\n] as const;\n` +
    '\n/**\n' +
    ' * Rama que corresponde a una edad. Es el RESPALDO de\n' +
    ' * `ramaDeEtiquetaSiscout`: SiScout guarda la rama en el campo `cargo` del\n' +
    ' * protagonista, pero se la pisa con el cargo de responsabilidad juvenil\n' +
    ' * (GUIA DE PATRULLA, PRESIDENTE DE CLAN…) en cuanto tiene uno. Sin este\n' +
    ' * respaldo, justo los protagonistas con más responsabilidad de su unidad son\n' +
    ' * los que se quedan sin ella.\n' +
    ' *\n' +
    ` * Fuera de rango devuelve \`undefined\`: por encima de ${ultima.ageRange[1]} ya no hay\n` +
    ' * progresión que ofrecer, y adivinar una rama sería peor que reportarlo.\n' +
    ' */\n' +
    'export function branchFromAge(\n' +
    '  age: number | null | undefined,\n' +
    '): Branch | undefined {\n' +
    '  if (age == null || !Number.isInteger(age)) return undefined;\n' +
    '  return BRANCH_AGE_RANGES.find((r) => age >= r.min && age <= r.max)\n' +
    '    ?.branch;\n' +
    '}\n'
  );
}

function messageKeyMap(
  constName: string,
  dominio: string,
  entries: NamedValue[],
): string {
  const filas = entries
    .map((e) => `  ${e.value}: '${dominio}.${e.name}',`)
    .join('\n');
  return `\nexport const ${constName} = {\n${filas}\n} as const;\n`;
}

function routeResourceLiteral(entry: RouteResourceEntry): string {
  const campos = [`path: '${entry.path}'`, `label: '${entry.label}'`];
  if (entry.section !== undefined) {
    campos.push(`section: '${entry.section}'`);
  }
  if (entry.always !== undefined) {
    campos.push(`always: ${entry.always}`);
  }
  return `  { ${campos.join(', ')} },`;
}

function routeResourcesBlock(entries: RouteResourceEntry[]): string {
  const filas = entries.map(routeResourceLiteral).join('\n');
  return (
    'export interface RouteResource {\n' +
    '  path: string;\n' +
    '  label: string;\n' +
    '  section?: string;\n' +
    '  always?: boolean;\n' +
    '}\n\n' +
    'export const ROUTE_RESOURCES: readonly RouteResource[] = [\n' +
    `${filas}\n` +
    '];\n'
  );
}

function dictionaryGroup(nombre: string, entries: NamedValue[]): string {
  const filas = entries.map((e) => `    ${e.name}: '${e.value}',`).join('\n');
  return `  ${nombre}: {\n${filas}\n  },\n`;
}

function branchGrowthAreasBlock(branches: BranchEntry[]): string {
  const filas = branches
    .map(
      (b) =>
        `  ${b.value}: [${b.growthAreas.map((a) => `'${a}'`).join(', ')}],`,
    )
    .join('\n');
  return (
    '\nexport const BRANCH_GROWTH_AREAS: Record<Branch, readonly GrowthArea[]> = {\n' +
    `${filas}\n} as const;\n` +
    '\n/** Áreas que aplican a una rama. Familia usa socioafectividad; el resto, las seis clásicas. */\n' +
    'export function growthAreasOf(branch: Branch): readonly GrowthArea[] {\n' +
    '  return BRANCH_GROWTH_AREAS[branch];\n' +
    '}\n'
  );
}

export function generateFiles(manifest: DomainManifest): Map<string, string> {
  const archivos = new Map<string, string>();

  archivos.set(
    'src/domain/branches.ts',
    HEADER +
      constAndType('BRANCHES', 'Branch', manifest.branches) +
      aliasMap(manifest.branches) +
      ageRangeMap(manifest.branches) +
      messageKeyMap('BRANCH_MESSAGE_KEY', 'BRANCH', manifest.branches),
  );

  archivos.set(
    'src/domain/access.ts',
    HEADER +
      constAndType('ACCESS_STATES', 'AccessState', manifest.accessStates) +
      '\n' +
      constAndType('ACCESS_LEVELS', 'AccessLevel', manifest.accessLevels) +
      '\n' +
      constAndType('REQUEST_STATES', 'RequestState', manifest.requestStates),
  );

  archivos.set(
    'src/domain/roles.ts',
    HEADER +
      constAndType('ROLE_LEVELS', 'RoleLevel', manifest.roleLevels) +
      '\n' +
      constAndType('PERSON_TYPES', 'PersonType', manifest.personTypes) +
      '\n' +
      constAndType('UNIT_ROLES', 'UnitRole', manifest.unitRoles),
  );

  archivos.set(
    'src/domain/diagnostic.ts',
    HEADER +
      constAndType(
        'DIAGNOSTIC_BLOCKS',
        'DiagnosticBlock',
        manifest.diagnosticBlocks,
      ) +
      messageKeyMap(
        'DIAGNOSTIC_BLOCK_MESSAGE_KEY',
        'DIAGNOSTIC_BLOCK',
        manifest.diagnosticBlocks,
      ),
  );

  archivos.set(
    'src/domain/growth-areas.ts',
    HEADER +
      "import type { Branch } from './branches';\n\n" +
      constAndType('GROWTH_AREAS', 'GrowthArea', manifest.growthAreas) +
      messageKeyMap(
        'GROWTH_AREA_MESSAGE_KEY',
        'GROWTH_AREA',
        manifest.growthAreas,
      ) +
      branchGrowthAreasBlock(manifest.branches),
  );

  archivos.set(
    'src/domain/permissions.ts',
    HEADER +
      `export const PERMISSION_KEYS = [${quoted(manifest.permissions.map((p) => p.key))}] as const;\n` +
      'export type PermissionKey = (typeof PERMISSION_KEYS)[number];\n',
  );

  archivos.set(
    'src/domain/route-resources.ts',
    HEADER + routeResourcesBlock(manifest.routeResources),
  );

  archivos.set(
    'src/domain/errors.ts',
    HEADER +
      constAndType('API_ERROR_CODES', 'ApiErrorCode', manifest.apiErrorCodes),
  );

  archivos.set(
    'src/domain/dictionary.ts',
    HEADER +
      'export const D = {\n' +
      dictionaryGroup('BRANCH', manifest.branches) +
      dictionaryGroup('ACCESS_STATE', manifest.accessStates) +
      dictionaryGroup('REQUEST_STATE', manifest.requestStates) +
      dictionaryGroup('ACCESS_LEVEL', manifest.accessLevels) +
      dictionaryGroup('ROLE_LEVEL', manifest.roleLevels) +
      dictionaryGroup('PERSON_TYPE', manifest.personTypes) +
      dictionaryGroup('UNIT_ROLE', manifest.unitRoles) +
      dictionaryGroup('DIAGNOSTIC_BLOCK', manifest.diagnosticBlocks) +
      dictionaryGroup('GROWTH_AREA', manifest.growthAreas) +
      dictionaryGroup('API_ERROR', manifest.apiErrorCodes) +
      '} as const;\n',
  );

  archivos.set(
    'src/domain/index.ts',
    HEADER +
      "export * from './access';\n" +
      "export * from './branches';\n" +
      "export * from './dictionary';\n" +
      "export * from './diagnostic';\n" +
      "export * from './errors';\n" +
      "export * from './growth-areas';\n" +
      "export * from './permissions';\n" +
      "export * from './roles';\n" +
      "export * from './route-resources';\n",
  );

  const vocabulario = [
    ...manifest.branches,
    ...manifest.accessStates,
    ...manifest.requestStates,
    ...manifest.accessLevels,
    ...manifest.roleLevels,
    ...manifest.personTypes,
    ...manifest.unitRoles,
    ...manifest.diagnosticBlocks,
    ...manifest.growthAreas,
  ].map((e) => e.value);
  archivos.set(
    '.domain-vocabulary.json',
    `${JSON.stringify([...new Set(vocabulario)].sort(), null, 2)}\n`,
  );

  return archivos;
}
