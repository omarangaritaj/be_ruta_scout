export interface NamedValue {
  name: string;
  value: string;
}

export interface BranchEntry extends NamedValue {
  order: number;
  siscoutAliases: string[];
}

export interface PermissionEntry {
  key: string;
  side: 'be' | 'fe' | 'both';
}

export interface DomainManifest {
  version: number;
  branches: BranchEntry[];
  accessStates: NamedValue[];
  requestStates: NamedValue[];
  accessLevels: NamedValue[];
  roleLevels: NamedValue[];
  personTypes: NamedValue[];
  permissions: PermissionEntry[];
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

export function readManifest(raw: string): DomainManifest {
  const manifest = JSON.parse(raw) as DomainManifest;
  const branches = [...manifest.branches].sort((a, b) => a.order - b.order);
  const ordenado = { ...manifest, branches };
  assertUnique(ordenado.branches, 'branches');
  assertUnique(ordenado.accessStates, 'accessStates');
  assertUnique(ordenado.requestStates, 'requestStates');
  assertUnique(ordenado.accessLevels, 'accessLevels');
  assertUnique(ordenado.roleLevels, 'roleLevels');
  assertUnique(ordenado.personTypes, 'personTypes');
  assertUnique(ordenado.apiErrorCodes, 'apiErrorCodes');
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

function dictionaryGroup(nombre: string, entries: NamedValue[]): string {
  const filas = entries.map((e) => `    ${e.name}: '${e.value}',`).join('\n');
  return `  ${nombre}: {\n${filas}\n  },\n`;
}

export function generateFiles(manifest: DomainManifest): Map<string, string> {
  const archivos = new Map<string, string>();

  archivos.set(
    'src/domain/branches.ts',
    HEADER +
      constAndType('BRANCHES', 'Branch', manifest.branches) +
      aliasMap(manifest.branches) +
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
      constAndType('PERSON_TYPES', 'PersonType', manifest.personTypes),
  );

  archivos.set(
    'src/domain/permissions.ts',
    HEADER +
      `export const PERMISSION_KEYS = [${quoted(manifest.permissions.map((p) => p.key))}] as const;\n` +
      'export type PermissionKey = (typeof PERMISSION_KEYS)[number];\n',
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
      dictionaryGroup('API_ERROR', manifest.apiErrorCodes) +
      '} as const;\n',
  );

  archivos.set(
    'src/domain/index.ts',
    HEADER +
      "export * from './access';\n" +
      "export * from './branches';\n" +
      "export * from './dictionary';\n" +
      "export * from './errors';\n" +
      "export * from './permissions';\n" +
      "export * from './roles';\n",
  );

  const vocabulario = [
    ...manifest.branches,
    ...manifest.accessStates,
    ...manifest.requestStates,
    ...manifest.accessLevels,
    ...manifest.roleLevels,
    ...manifest.personTypes,
  ].map((e) => e.value);
  archivos.set(
    '.domain-vocabulary.json',
    `${JSON.stringify([...new Set(vocabulario)].sort(), null, 2)}\n`,
  );

  return archivos;
}
