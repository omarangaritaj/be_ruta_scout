# Diccionario de dominio, Fase 1 (be_ruta) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar los 164 literales de vocabulario de dominio de `be_ruta/src` y sustituirlos por un módulo generado desde `domain-manifest.json`, protegido por una regla de ESLint bloqueante.

**Architecture:** `domain-manifest.json` es la fuente de verdad. `pnpm domain:gen` lo transforma en `src/domain/*.ts` (constantes `as const`, tipos literales, accesor `D`) y en `.domain-vocabulary.json` (lista de literales prohibidos que alimenta ESLint). `pnpm domain:check` regenera en memoria y falla ante cualquier diferencia, así que el módulo nunca puede divergir del manifiesto ni escribirse a mano.

**Tech Stack:** NestJS 11, TypeScript 5.7, Mongoose 11, jest 30 con ts-jest, ESLint 9 flat config, prettier 3, pnpm.

**Spec:** `docs/superpowers/specs/2026-07-27-diccionario-dominio-design.md`

## Global Constraints

- **pnpm siempre**, nunca npm.
- **Identificadores del código nuevo en inglés.** Las claves del diccionario son inglés UPPER_SNAKE; los valores son los strings reales del contrato, en español.
- **Sin comentarios** salvo un porqué no evidente (workaround, invariante de seguridad, decisión contraintuitiva).
- **Sin em dashes** en ninguna salida.
- **Conventional Commits en español con scope**, sin co-authors ni atribución de IA.
- **prettier del repo**: `singleQuote: true`, `trailingComma: "all"`. Todo archivo generado debe salir ya conforme, porque `pnpm format` reformatea `src/**/*.ts` y rompería `domain:check`.
- **jest**: `rootDir: src`, `testRegex: .*\.spec\.ts$`.
- **`tsconfig.build.json` excluye `scripts/`**: el generador vive ahí y no llega a `dist`.
- **El guard de ESLint se activa en la última tarea.** Las tareas intermedias dejan literales a medio migrar y el lint debe seguir pasando mientras tanto.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `domain-manifest.json` | Fuente de verdad. Único archivo espejado con fe_ruta |
| `scripts/domain-codegen.ts` | Lógica pura: manifiesto en memoria a texto TypeScript. Sin I/O |
| `scripts/domain-render.ts` | Lee el manifiesto del disco y aplica prettier. Sin efectos al importarse |
| `scripts/domain-gen.ts` | CLI: escribe lo que `domain-render` produce |
| `scripts/domain-check.ts` | CLI: compara lo que `domain-render` produce contra el disco. Verifica paridad con el repo hermano |
| `scripts/domain-codegen.spec.ts` | Tests del codegen puro |
| `src/domain/branches.ts` | GENERADO. `BRANCHES`, `Branch`, alias de SiScout |
| `src/domain/access.ts` | GENERADO. `ACCESS_STATES`, `AccessState`, `ACCESS_LEVELS`, `AccessLevel` |
| `src/domain/roles.ts` | GENERADO. `ROLE_LEVELS`, `RoleLevel`, `PERSON_TYPES`, `PersonType` |
| `src/domain/permissions.ts` | GENERADO. `PERMISSION_KEYS`, `PermissionKey` |
| `src/domain/errors.ts` | GENERADO. `API_ERROR_CODES`, `ApiErrorCode` |
| `src/domain/dictionary.ts` | GENERADO. Accesor tipado `D` |
| `src/domain/index.ts` | GENERADO. Re-exporta todo lo anterior |
| `src/domain/domain.spec.ts` | ESCRITO A MANO. Contrato observable del dominio |
| `.domain-vocabulary.json` | GENERADO. Literales prohibidos para ESLint |

## Decisión de alcance registrada durante la planificación

`CARGOS` (33 entradas de `src/catalogo-cargos/catalogo-cargos.ts`) y las
descripciones de `PERMISSIONS` **no** se mudan a i18n ni al manifiesto. El
proyecto ya decidió esto: `src/i18n/catalog.ts` documenta que los catálogos de
dominio quedan fuera del i18n a propósito por ser "datos, no mensajes". Además
viajan al frontend por HTTP (`/solicitudes-acceso/contexto`,
`/unidades/jefatura`, `/roles/permissions`), así que no necesitan espejo.

Lo que sí cambia en esos archivos: sus campos `nivel` y `rama` pasan a usar los
tipos y constantes generados en vez de literales.

Esto corrige una línea del spec que decía que las descripciones de permisos se
mudaban a i18n. Se mantienen donde están.

---

### Task 1: Manifiesto, generador y módulo de dominio

**Files:**
- Create: `domain-manifest.json`
- Create: `scripts/domain-codegen.ts`
- Create: `scripts/domain-render.ts`
- Create: `scripts/domain-gen.ts`
- Create: `scripts/domain-check.ts`
- Create: `scripts/domain-codegen.spec.ts`
- Create: `src/domain/domain.spec.ts`
- Modify: `package.json` (scripts `domain:gen`, `domain:check`; jest `roots`)
- Generated: `src/domain/*.ts`, `.domain-vocabulary.json`

**Interfaces:**
- Produces:
  - `readManifest(raw: string): DomainManifest` en `scripts/domain-codegen.ts`
  - `generateFiles(manifest: DomainManifest): Map<string, string>` en `scripts/domain-codegen.ts`, devuelve rutas relativas al repo con su contenido sin formatear
  - `src/domain/index.ts` re-exporta `BRANCHES`, `Branch`, `BRANCH_SISCOUT_ALIASES`, `ACCESS_STATES`, `AccessState`, `ACCESS_LEVELS`, `AccessLevel`, `ROLE_LEVELS`, `RoleLevel`, `PERSON_TYPES`, `PersonType`, `PERMISSION_KEYS`, `PermissionKey`, `API_ERROR_CODES`, `ApiErrorCode`, `D`
  - El accesor `D` expone `D.BRANCH.*`, `D.ACCESS_STATE.*`, `D.ACCESS_LEVEL.*`, `D.ROLE_LEVEL.*`, `D.PERSON_TYPE.*`

- [ ] **Step 1: Habilitar jest en `scripts/`**

`jest.rootDir` es `src`, así que hoy los tests de `scripts/` no se ejecutan. En `package.json`, dentro del bloque `"jest"`, añade `roots` justo después de `"rootDir": "src"`:

```json
    "rootDir": "src",
    "roots": [
      "<rootDir>",
      "<rootDir>/../scripts"
    ],
```

- [ ] **Step 2: Escribir el test del codegen (falla)**

Crea `scripts/domain-codegen.spec.ts`:

```ts
import { generateFiles, readManifest } from './domain-codegen';

const MANIFEST = JSON.stringify({
  version: 1,
  branches: [
    { name: 'MANADA', value: 'manada', order: 2, siscoutAliases: ['MANADA', 'LOBATO'] },
  ],
  accessStates: [{ name: 'APPROVED', value: 'aprobado' }],
  accessLevels: [{ name: 'SUPER_ADMIN', value: 'super_admin' }],
  roleLevels: [{ name: 'RAMA', value: 'rama' }],
  personTypes: [{ name: 'ADULT', value: 'adulto' }],
  permissions: [{ key: 'user:read', side: 'both' }],
  apiErrorCodes: [{ name: 'UNITS_MISSING_GROUP', value: 'UNITS.MISSING_GROUP' }],
});

describe('domain codegen', () => {
  it('rechaza un manifiesto con valores duplicados', () => {
    const duplicado = JSON.stringify({
      version: 1,
      branches: [
        { name: 'A', value: 'manada', order: 1, siscoutAliases: [] },
        { name: 'B', value: 'manada', order: 2, siscoutAliases: [] },
      ],
      accessStates: [],
      accessLevels: [],
      roleLevels: [],
      personTypes: [],
      permissions: [],
      apiErrorCodes: [],
    });
    expect(() => readManifest(duplicado)).toThrow(/duplicado/i);
  });

  it('emite la constante y el tipo de cada grupo', () => {
    const archivos = generateFiles(readManifest(MANIFEST));
    const branches = archivos.get('src/domain/branches.ts');
    expect(branches).toContain("export const BRANCHES = ['manada'] as const;");
    expect(branches).toContain(
      'export type Branch = (typeof BRANCHES)[number];',
    );
  });

  it('emite el accesor tipado D', () => {
    const archivos = generateFiles(readManifest(MANIFEST));
    const dictionary = archivos.get('src/domain/dictionary.ts');
    expect(dictionary).toContain("MANADA: 'manada'");
    expect(dictionary).toContain("APPROVED: 'aprobado'");
  });

  it('emite el vocabulario prohibido sin permisos ni códigos de error', () => {
    const archivos = generateFiles(readManifest(MANIFEST));
    const vocabulario = JSON.parse(
      archivos.get('.domain-vocabulary.json') as string,
    ) as string[];
    expect(vocabulario).toContain('manada');
    expect(vocabulario).toContain('aprobado');
    expect(vocabulario).not.toContain('user:read');
  });

  it('ordena las ramas por el campo order', () => {
    const desordenado = JSON.stringify({
      version: 1,
      branches: [
        { name: 'CLAN', value: 'clan', order: 5, siscoutAliases: [] },
        { name: 'MANADA', value: 'manada', order: 2, siscoutAliases: [] },
      ],
      accessStates: [],
      accessLevels: [],
      roleLevels: [],
      personTypes: [],
      permissions: [],
      apiErrorCodes: [],
    });
    const archivos = generateFiles(readManifest(desordenado));
    expect(archivos.get('src/domain/branches.ts')).toContain(
      "export const BRANCHES = ['manada', 'clan'] as const;",
    );
  });
});
```

- [ ] **Step 3: Verificar que falla**

Run: `pnpm test -- domain-codegen`
Expected: FAIL con "Cannot find module './domain-codegen'"

- [ ] **Step 4: Escribir el manifiesto**

Crea `domain-manifest.json` en la raíz de `be_ruta`. Los valores salen tal cual de las constantes que ya existen (`ramas.ts`, `user.schema.ts`, `cargo.subschema.ts`, `catalogo-cargos.ts`, `permissions.catalog.ts`):

```json
{
  "version": 1,
  "branches": [
    {
      "name": "FAMILIA",
      "value": "familia",
      "order": 1,
      "siscoutAliases": ["FAMILIA", "CACHORRO", "CACHORROS"]
    },
    {
      "name": "MANADA",
      "value": "manada",
      "order": 2,
      "siscoutAliases": ["MANADA", "LOBATO", "LOBATOS"]
    },
    {
      "name": "TROPA",
      "value": "tropa",
      "order": 3,
      "siscoutAliases": ["TROPA", "SCOUT", "SCOUTS"]
    },
    {
      "name": "COMUNIDAD",
      "value": "comunidad",
      "order": 4,
      "siscoutAliases": [
        "COMUNIDAD",
        "NOMADA",
        "NOMADA SCOUT",
        "NOMADAS SCOUT"
      ]
    },
    {
      "name": "CLAN",
      "value": "clan",
      "order": 5,
      "siscoutAliases": ["CLAN", "ROVER", "ROVERS"]
    }
  ],
  "accessStates": [
    { "name": "NO_REQUEST", "value": "sin_solicitud" },
    { "name": "PENDING", "value": "pendiente" },
    { "name": "APPROVED", "value": "aprobado" },
    { "name": "REJECTED", "value": "rechazado" },
    { "name": "SUSPENDED", "value": "suspendido" }
  ],
  "accessLevels": [
    { "name": "RAMA", "value": "rama" },
    { "name": "GRUPO", "value": "grupo" },
    { "name": "REGION", "value": "region" },
    { "name": "NACION", "value": "nacion" },
    { "name": "SUPER_ADMIN", "value": "super_admin" }
  ],
  "roleLevels": [
    { "name": "RAMA", "value": "rama" },
    { "name": "GRUPO", "value": "grupo" },
    { "name": "REGION", "value": "region" },
    { "name": "NACION", "value": "nacion" }
  ],
  "personTypes": [
    { "name": "ADULT", "value": "adulto" },
    { "name": "PROTAGONIST", "value": "protagonista" }
  ],
  "permissions": [
    { "key": "role:read", "side": "both" },
    { "key": "role:create", "side": "both" },
    { "key": "role:update", "side": "both" },
    { "key": "role:delete", "side": "both" },
    { "key": "user:read", "side": "both" },
    { "key": "user:approve", "side": "both" },
    { "key": "solicitud:read", "side": "both" },
    { "key": "solicitud:approve", "side": "both" },
    { "key": "solicitud:reject", "side": "both" },
    { "key": "unidad:read", "side": "both" },
    { "key": "unidad:create", "side": "both" },
    { "key": "unidad:update", "side": "both" },
    { "key": "unidad:delete", "side": "both" },
    { "key": "grupo:read", "side": "both" },
    { "key": "grupo:create", "side": "both" },
    { "key": "grupo:update", "side": "both" },
    { "key": "grupo:delete", "side": "both" },
    { "key": "siscout:sync", "side": "be" },
    { "key": "siscout:config", "side": "both" },
    { "key": "siscout:credentials", "side": "be" },
    { "key": "tablero:nacional", "side": "fe" }
  ],
  "apiErrorCodes": [
    { "name": "UNITS_LEADERSHIP_REQUIRED", "value": "UNITS.LEADERSHIP_REQUIRED" },
    { "name": "UNITS_MISSING_GROUP", "value": "UNITS.MISSING_GROUP" },
    { "name": "VALIDATION_INVALID_INPUT", "value": "VALIDATION.INVALID_INPUT" }
  ]
}
```

Nota sobre `side`: el campo se llama `side` con valores `be | fe | both`, en
inglés, porque el manifiesto es código nuevo. El tipo `PermissionSide` actual
del repo usa `'be' | 'fe' | 'ambos'`; la traducción ocurre en la Tarea 5.

- [ ] **Step 5: Implementar el codegen puro**

Crea `scripts/domain-codegen.ts`:

```ts
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
    .flatMap((b) => b.siscoutAliases.map((alias) => `  '${alias}': '${b.value}',`))
    .join('\n');
  return (
    '\nexport const BRANCH_SISCOUT_ALIASES: Record<string, Branch> = {\n' +
    `${filas}\n};\n`
  );
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
      aliasMap(manifest.branches),
  );

  archivos.set(
    'src/domain/access.ts',
    HEADER +
      constAndType('ACCESS_STATES', 'AccessState', manifest.accessStates) +
      '\n' +
      constAndType('ACCESS_LEVELS', 'AccessLevel', manifest.accessLevels),
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
    HEADER + constAndType('API_ERROR_CODES', 'ApiErrorCode', manifest.apiErrorCodes),
  );

  archivos.set(
    'src/domain/dictionary.ts',
    HEADER +
      'export const D = {\n' +
      dictionaryGroup('BRANCH', manifest.branches) +
      dictionaryGroup('ACCESS_STATE', manifest.accessStates) +
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
```

El vocabulario prohibido deja fuera a propósito los permisos y los códigos de
error: `'user:read'` y `'UNITS.MISSING_GROUP'` no colisionan con nombres de
propiedad ni con texto, así que su literal es inequívoco y no necesita guard.

- [ ] **Step 6: Verificar que el test pasa**

Run: `pnpm test -- domain-codegen`
Expected: PASS, 5 tests

- [ ] **Step 7: Implementar el render (lectura y formato, sin efectos)**

Este módulo va aparte de los dos CLI a propósito: `domain-check` necesita
importar `renderAll`, y si viviera en `domain-gen` el simple import dispararía
la escritura de los archivos antes de poder verificarlos.

Crea `scripts/domain-render.ts`:

```ts
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
```

- [ ] **Step 8: Implementar el CLI de generación**

Crea `scripts/domain-gen.ts`:

```ts
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
  console.log(`domain:gen OK — ${archivos.size} archivo(s) generado(s)`);
}

void main();
```

- [ ] **Step 9: Implementar el CLI de verificación**

Crea `scripts/domain-check.ts`:

```ts
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
      'domain:check — fe_ruta no está presente: paridad cruzada NO verificada',
    );
  }

  if (fallos.length > 0) {
    console.error(`✗ ${fallos.length} problema(s) de dominio:`);
    for (const fallo of fallos) console.error(`  - ${fallo}`);
    process.exit(1);
  }

  console.log(`domain:check OK — manifiesto ${propio.slice(0, 12)}`);
}

void main();
```

- [ ] **Step 10: Registrar los comandos**

En `package.json`, añade junto a `i18n:check`:

```json
    "domain:gen": "ts-node -P tsconfig.json scripts/domain-gen.ts",
    "domain:check": "ts-node -P tsconfig.json scripts/domain-check.ts",
```

- [ ] **Step 11: Generar el módulo**

Run: `pnpm domain:gen`
Expected: `domain:gen OK — 8 archivo(s) generado(s)`

- [ ] **Step 12: Escribir el test de contrato del dominio**

Crea `src/domain/domain.spec.ts`. Este test es el contrato observable: verifica los valores, no la maquinaria del generador.

```ts
import {
  ACCESS_LEVELS,
  ACCESS_STATES,
  BRANCHES,
  BRANCH_SISCOUT_ALIASES,
  D,
  PERMISSION_KEYS,
  PERSON_TYPES,
  ROLE_LEVELS,
} from './index';

describe('diccionario de dominio', () => {
  it('tiene las cinco ramas en orden de progresión', () => {
    expect(BRANCHES).toEqual([
      'familia',
      'manada',
      'tropa',
      'comunidad',
      'clan',
    ]);
  });

  it('mapea los alias de SiScout a su rama', () => {
    expect(BRANCH_SISCOUT_ALIASES.LOBATOS).toBe('manada');
    expect(BRANCH_SISCOUT_ALIASES.MANADA).toBe('manada');
    expect(BRANCH_SISCOUT_ALIASES['NOMADAS SCOUT']).toBe('comunidad');
  });

  it('tiene los cinco estados de acceso', () => {
    expect(ACCESS_STATES).toEqual([
      'sin_solicitud',
      'pendiente',
      'aprobado',
      'rechazado',
      'suspendido',
    ]);
  });

  it('distingue niveles de acceso de niveles de cargo', () => {
    expect(ACCESS_LEVELS).toContain('super_admin');
    expect(ROLE_LEVELS).not.toContain('super_admin');
    expect(ROLE_LEVELS).toEqual(['rama', 'grupo', 'region', 'nacion']);
  });

  it('tiene los dos tipos de persona', () => {
    expect(PERSON_TYPES).toEqual(['adulto', 'protagonista']);
  });

  it('tiene los 21 permisos del catálogo', () => {
    expect(PERMISSION_KEYS).toHaveLength(21);
    expect(PERMISSION_KEYS).toContain('user:read');
  });

  it('expone el accesor tipado D', () => {
    expect(D.BRANCH.MANADA).toBe('manada');
    expect(D.ACCESS_STATE.APPROVED).toBe('aprobado');
    expect(D.ACCESS_LEVEL.SUPER_ADMIN).toBe('super_admin');
    expect(D.PERSON_TYPE.ADULT).toBe('adulto');
  });
});
```

- [ ] **Step 12: Verificar que pasa**

Run: `pnpm test -- domain`
Expected: PASS, los 5 del codegen y los 7 del contrato

- [ ] **Step 13: Verificar que el check detecta manipulación**

Run:
```bash
echo '// sabotaje' >> src/domain/branches.ts && pnpm domain:check; pnpm domain:gen
```
Expected: el check sale con código 1 y el mensaje `src/domain/branches.ts: difiere del manifiesto`, y el `domain:gen` posterior restaura el archivo.

- [ ] **Step 14: Verificar que prettier no altera lo generado**

Run: `pnpm format && pnpm domain:check`
Expected: `domain:check OK`. Si falla aquí, el generador no está respetando la config de prettier y hay que corregirlo antes de seguir.

- [ ] **Step 15: Commit**

```bash
git add domain-manifest.json scripts/domain-*.ts src/domain package.json .domain-vocabulary.json
git commit -m "feat(domain): manifiesto de dominio con generador y verificación"
```

---

### Task 2: Guard de ESLint alimentado por el vocabulario generado

**Files:**
- Modify: `eslint.config.mjs`

**Interfaces:**
- Consumes: `.domain-vocabulary.json` generado en la Tarea 1
- Produces: regla `no-restricted-syntax` activa en modo `warn`. Pasa a `error` en la Tarea 8

- [ ] **Step 1: Añadir la regla**

En `eslint.config.mjs`, antes del `export default`, lee el vocabulario y construye el selector. Añade al principio del archivo:

```js
import { readFileSync } from 'node:fs';

const DOMAIN_VOCABULARY = JSON.parse(
  readFileSync(new URL('./.domain-vocabulary.json', import.meta.url), 'utf8'),
);

const VOCABULARY_PATTERN = `^(${DOMAIN_VOCABULARY.join('|')})$`;
```

Y añade este bloque de configuración como último elemento de `tseslint.config(...)`:

```js
  {
    files: ['src/**/*.ts'],
    ignores: ['src/domain/**', 'src/**/*.spec.ts', 'src/seeds/**', 'src/tools/**'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: `BinaryExpression > Literal[value=/${VOCABULARY_PATTERN}/]`,
          message:
            'Literal de dominio en una comparación. Usa el diccionario: import { D } from "../domain".',
        },
        {
          selector: `VariableDeclarator > Literal[value=/${VOCABULARY_PATTERN}/]`,
          message:
            'Literal de dominio en una asignación. Usa el diccionario: import { D } from "../domain".',
        },
        {
          selector: `CallExpression > Literal[value=/${VOCABULARY_PATTERN}/]`,
          message:
            'Literal de dominio como argumento. Usa el diccionario: import { D } from "../domain".',
        },
        {
          selector: `Property[computed=false] > Literal.value[value=/${VOCABULARY_PATTERN}/]`,
          message:
            'Literal de dominio como valor de propiedad. Usa el diccionario: import { D } from "../domain".',
        },
        {
          selector: `ArrayExpression > Literal[value=/${VOCABULARY_PATTERN}/]`,
          message:
            'Literal de dominio en un arreglo. Usa el diccionario: import { D } from "../domain".',
        },
      ],
    },
  },
```

El selector `Property[computed=false] > Literal.value` apunta al **valor** de la
propiedad, nunca a su clave: por eso `{ grupo: 1 }` no dispara la regla y
`{ nivel: 'grupo' }` sí. Ese es exactamente el falso positivo que había que
evitar, porque `grupo`, `region` y `rama` también son nombres de campo.

- [ ] **Step 2: Verificar que la regla detecta los literales actuales**

Run: `pnpm lint:check 2>&1 | rg -c 'Literal de dominio'`
Expected: un número mayor que 100. Si sale 0, el selector está mal y hay que corregirlo antes de seguir.

- [ ] **Step 3: Verificar que NO marca nombres de propiedad**

Run: `pnpm lint:check 2>&1 | rg 'Literal de dominio' | rg -c 'grupos.service|grupos.controller' || echo 'sin falsos positivos en grupos'`
Expected: los aciertos en los módulos de grupo, si los hay, deben corresponder a valores y no a claves. Revisa a mano dos o tres con `pnpm lint:check` y confirma que apuntan a un valor.

- [ ] **Step 4: Verificar que el lint sigue pasando**

Run: `pnpm lint:check`
Expected: exit 0 con warnings. Si sale distinto de 0, la regla quedó en `error` por accidente.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs
git commit -m "feat(domain): guard de eslint contra literales de dominio en modo aviso"
```

---

### Task 3: Migrar los schemas de Mongoose

**Files:**
- Modify: `src/users/schemas/user.schema.ts`
- Modify: `src/users/schemas/cargo.subschema.ts`
- Modify: `src/solicitudes-acceso/schemas/solicitud-acceso.schema.ts`
- Modify: `src/notificaciones/schemas/notificacion.schema.ts`
- Test: `src/users/schemas/user.schema.spec.ts` (ya existe)

**Interfaces:**
- Consumes: `ACCESS_STATES`, `ACCESS_LEVELS`, `PERSON_TYPES`, `ROLE_LEVELS` de `src/domain`
- Produces: `user.schema.ts` deja de exportar `TIPOS_PERSONA`, `ESTADOS_ACCESO` y `NIVELES_ACCESO` como listas propias; las re-exporta desde el dominio con sus nombres actuales para no romper a sus consumidores en esta tarea

- [ ] **Step 1: Ejecutar la suite antes de tocar nada**

Run: `pnpm test`
Expected: PASS. Anota el número de tests: es la línea base que las tareas 3 a 7 deben conservar.

- [ ] **Step 2: Sustituir las listas de `user.schema.ts`**

Reemplaza los bloques de las líneas 8 a 27 por re-exportaciones del dominio:

```ts
import {
  ACCESS_LEVELS,
  ACCESS_STATES,
  PERSON_TYPES,
  type AccessLevel,
  type AccessState,
  type PersonType,
} from '../../domain';

export const TIPOS_PERSONA = PERSON_TYPES;
export type TipoPersona = PersonType;

export const ESTADOS_ACCESO = ACCESS_STATES;
export type EstadoAcceso = AccessState;

export const NIVELES_ACCESO = ACCESS_LEVELS;
export type NivelAcceso = AccessLevel;
```

Los `@Prop({ enum: TIPOS_PERSONA })` y demás no cambian: siguen apuntando a los mismos nombres, ahora respaldados por el dominio.

- [ ] **Step 3: Sustituir la lista de `cargo.subschema.ts`**

Reemplaza las líneas 3 y 4:

```ts
import { ROLE_LEVELS, type RoleLevel } from '../../domain';

export const NIVELES_CARGO = ROLE_LEVELS;
export type NivelCargo = RoleLevel;
```

- [ ] **Step 4: Migrar los literales de los otros dos schemas**

En `src/solicitudes-acceso/schemas/solicitud-acceso.schema.ts` y
`src/notificaciones/schemas/notificacion.schema.ts`, localiza los literales:

Run: `rg -n "'(sin_solicitud|pendiente|aprobado|rechazado|suspendido|super_admin|nacion|region|grupo|rama|adulto|protagonista)'" src/solicitudes-acceso/schemas/solicitud-acceso.schema.ts src/notificaciones/schemas/notificacion.schema.ts`

Sustituye cada uno según esta tabla:

| Literal | Constante |
|---|---|
| `'sin_solicitud'` | `D.ACCESS_STATE.NO_REQUEST` |
| `'pendiente'` | `D.ACCESS_STATE.PENDING` |
| `'aprobado'` | `D.ACCESS_STATE.APPROVED` |
| `'rechazado'` | `D.ACCESS_STATE.REJECTED` |
| `'suspendido'` | `D.ACCESS_STATE.SUSPENDED` |
| `'super_admin'` | `D.ACCESS_LEVEL.SUPER_ADMIN` |
| `'nacion'` | `D.ACCESS_LEVEL.NACION` |
| `'region'` | `D.ACCESS_LEVEL.REGION` |
| `'grupo'` | `D.ACCESS_LEVEL.GRUPO` |
| `'rama'` (nivel de cargo) | `D.ROLE_LEVEL.RAMA` |
| `'adulto'` | `D.PERSON_TYPE.ADULT` |
| `'protagonista'` | `D.PERSON_TYPE.PROTAGONIST` |
| `'familia'`, `'manada'`, `'tropa'`, `'comunidad'`, `'clan'` | `D.BRANCH.FAMILIA` y equivalentes |

Si un literal está dentro de un arreglo que alimenta un `enum` de Mongoose, usa la constante completa (`ACCESS_STATES`) en vez de enumerar los valores uno a uno.

- [ ] **Step 5: Verificar tipos y tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS, con el mismo número de tests de la línea base

- [ ] **Step 6: Commit**

```bash
git add src/users/schemas src/solicitudes-acceso/schemas src/notificaciones/schemas
git commit -m "refactor(domain): los schemas consumen el diccionario en vez de literales"
```

---

### Task 4: Migrar el catálogo de cargos y ramas

**Files:**
- Modify: `src/catalogo-cargos/ramas.ts` (21 literales)
- Modify: `src/catalogo-cargos/catalogo-cargos.ts` (44 literales)
- Test: `src/catalogo-cargos/ramas.spec.ts`, `src/catalogo-cargos/catalogo-cargos.spec.ts` (ya existen)

**Interfaces:**
- Consumes: `BRANCHES`, `Branch`, `BRANCH_SISCOUT_ALIASES`, `ROLE_LEVELS`, `RoleLevel`, `D`
- Produces: `ramas.ts` conserva `esRama()` y `ramaDeEtiquetaSiscout()` con su firma actual. `RAMAS` y `Rama` pasan a ser alias del dominio. `ETIQUETA_RAMA` se elimina

- [ ] **Step 1: Reescribir `ramas.ts`**

El mapa de alias y la lista de ramas salen del dominio. La lógica de
normalización se queda, porque es comportamiento, no vocabulario:

```ts
import { BRANCHES, BRANCH_SISCOUT_ALIASES, type Branch } from '../domain';

export const RAMAS = BRANCHES;
export type Rama = Branch;

const DIACRITICOS = /\p{Diacritic}/gu;

const normalizar = (valor: string): string =>
  valor
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

export function esRama(valor: unknown): valor is Rama {
  return (
    typeof valor === 'string' && (RAMAS as readonly string[]).includes(valor)
  );
}

/**
 * Rama a partir de una etiqueta de SiScout, sea nombre de unidad (`MANADA`) o
 * de rama (`LOBATO`). La comparación es exacta contra el catálogo de alias, no
 * por subcadena: `COMISIONADO(A) NACIONAL PARA LOBATOS` NO dirige una manada.
 */
export function ramaDeEtiquetaSiscout(
  etiqueta: string | null | undefined,
): Rama | undefined {
  if (!etiqueta) return undefined;
  return BRANCH_SISCOUT_ALIASES[normalizar(etiqueta)];
}
```

`ETIQUETA_RAMA` desaparece. Localiza a sus consumidores antes de borrarlo:

Run: `rg -n 'ETIQUETA_RAMA' src`

Cada consumidor pasa a resolver la etiqueta por i18n.

- [ ] **Step 2: Añadir las etiquetas de rama al catálogo i18n**

En `src/i18n/catalog.ts`, añade el dominio `BRANCH` en su posición alfabética,
con las claves en el mismo UPPER_SNAKE que el manifiesto:

```ts
  BRANCH: {
    CLAN: 'Clan',
    COMUNIDAD: 'Comunidad',
    FAMILIA: 'Familia',
    MANADA: 'Manada',
    TROPA: 'Tropa',
  },
```

- [ ] **Step 3: Extender `domain-check.ts` con la coherencia de i18n**

El manifiesto y el catálogo i18n pueden desincronizarse: agregar una rama sin su
etiqueta rompería la UI en runtime. Añade esta comprobación a
`scripts/domain-check.ts`, justo antes del bloque de paridad con el hermano:

```ts
import { CATALOG } from '../src/i18n/catalog';
import { readManifest } from './domain-codegen';

// ... dentro de main(), antes del cálculo de `propio`:
  const manifest = readManifest(readFileSync(MANIFEST_PATH, 'utf8'));
  const branchLabels = CATALOG.BRANCH as Record<string, string>;
  for (const branch of manifest.branches) {
    if (!branchLabels[branch.name]) {
      fallos.push(
        `i18n: falta la clave BRANCH.${branch.name} para la rama '${branch.value}'`,
      );
    }
  }
```

- [ ] **Step 4: Verificar que la comprobación de i18n muerde**

Run:
```bash
pnpm domain:check
```
Expected: `domain:check OK`. Para confirmar que la comprobación funciona, borra
temporalmente la clave `MANADA` del catálogo, corre `pnpm domain:check`, confirma
que falla con `falta la clave BRANCH.MANADA`, y restáurala.

- [ ] **Step 5: Verificar los tests de ramas**

Run: `pnpm test -- ramas`
Expected: PASS sin modificar el spec. Sus tests usan literales a propósito, que es correcto en una aserción de contrato.

- [ ] **Step 6: Migrar `catalogo-cargos.ts`**

Sustituye las líneas 3 y 4 por el dominio:

```ts
import { ROLE_LEVELS, type RoleLevel } from '../domain';

export const NIVELES_SOLICITUD = ROLE_LEVELS;
export type NivelSolicitud = RoleLevel;
```

Esto elimina la cuarta lista duplicada de niveles: `NIVELES_SOLICITUD` era
idéntica a `NIVELES_CARGO`.

En las 33 entradas de `CARGOS`, sustituye `nivel: 'rama'` por
`nivel: D.ROLE_LEVEL.RAMA`, `rama: 'familia'` por `rama: D.BRANCH.FAMILIA`, y
así con cada uno. Los strings de `cargo` y `etiqueta` NO se tocan: el primero es
el valor exacto de SiScout, el segundo es un dato del catálogo que viaja al
frontend por HTTP.

En la línea 219, `CARGOS.filter((c) => c.nivel === 'rama')` pasa a
`c.nivel === D.ROLE_LEVEL.RAMA`.

En `ETIQUETA_NIVEL_SOLICITABLE` (línea 223) las claves del `Record` son nombres
de propiedad, no valores: se quedan como están.

- [ ] **Step 7: Verificar tipos y tests**

Run: `pnpm typecheck && pnpm test && pnpm i18n:check && pnpm domain:check`
Expected: PASS con la línea base de tests, y los dos checks en verde

- [ ] **Step 8: Verificar que bajaron los avisos**

Run: `pnpm lint:check 2>&1 | rg -c 'Literal de dominio'`
Expected: al menos 60 avisos menos que en la Tarea 2 (`ramas.ts` aportaba 21 y `catalogo-cargos.ts` 44)

- [ ] **Step 9: Commit**

```bash
git add src/catalogo-cargos src/i18n scripts/domain-check.ts
git commit -m "refactor(domain): el catálogo de cargos y ramas consume el diccionario"
```

---

### Task 5: Migrar el catálogo de permisos

**Files:**
- Modify: `src/authz/permissions.catalog.ts`
- Test: crear `src/authz/permissions.catalog.spec.ts`

**Interfaces:**
- Consumes: `PERMISSION_KEYS`, `PermissionKey` de `src/domain`
- Produces: `PERMISSIONS` conserva su forma `{ key, descripcion, lado }`. `PERMISSION_KEYS` se re-exporta desde el dominio. `ALL_PERMISSION`, `isValidPermission` y `granting` no cambian de firma

- [ ] **Step 1: Escribir el test que ata el catálogo al dominio**

Crea `src/authz/permissions.catalog.spec.ts`:

```ts
import { PERMISSION_KEYS as DOMAIN_KEYS } from '../domain';
import { PERMISSIONS, granting, isValidPermission } from './permissions.catalog';

describe('catálogo de permisos', () => {
  it('describe exactamente los permisos del dominio', () => {
    expect(PERMISSIONS.map((p) => p.key).sort()).toEqual([...DOMAIN_KEYS].sort());
  });

  it('da una descripción no vacía a cada permiso', () => {
    for (const permiso of PERMISSIONS) {
      expect(permiso.descripcion.length).toBeGreaterThan(0);
    }
  });

  it('acepta el comodín de recurso', () => {
    expect(isValidPermission('user:*')).toBe(true);
    expect(isValidPermission('inventado:*')).toBe(false);
  });

  it('concede por comodín total y por recurso', () => {
    expect(granting(new Set(['*']), 'user:read')).toBe(true);
    expect(granting(new Set(['user:*']), 'user:read')).toBe(true);
    expect(granting(new Set(['role:read']), 'user:read')).toBe(false);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm test -- permissions.catalog`
Expected: FAIL en el primer test, porque `PERMISSIONS` aún no está atado al dominio y `PERMISSION_KEYS` se deriva de sí mismo

Si pasara en verde de entrada, comprueba que el import viene de `../domain` y no del propio catálogo.

- [ ] **Step 3: Atar el catálogo al dominio**

En `permissions.catalog.ts`, cambia el tipo de `key` y la derivación de las claves:

```ts
import { PERMISSION_KEYS, type PermissionKey } from '../domain';

export interface PermissionDef {
  key: PermissionKey;
  descripcion: string;
  lado: PermissionSide;
}
```

Y sustituye la línea 80:

```ts
export { PERMISSION_KEYS };
const PERMISSION_SET = new Set<string>(PERMISSION_KEYS);
```

El arreglo `PERMISSIONS` mantiene sus 21 entradas con sus descripciones. Ahora
`key` es un tipo literal: si alguien escribe un permiso que no está en el
manifiesto, TypeScript lo rechaza.

- [ ] **Step 4: Verificar**

Run: `pnpm typecheck && pnpm test -- permissions`
Expected: PASS, 4 tests nuevos

- [ ] **Step 5: Commit**

```bash
git add src/authz
git commit -m "feat(authz): las claves de permiso salen del diccionario de dominio"
```

---

### Task 6: Migrar usuarios, solicitudes y unidades

**Files:**
- Modify: `src/solicitudes-acceso/solicitudes-acceso.service.ts` (14)
- Modify: `src/solicitudes-acceso/territorio.ts` (3)
- Modify: `src/users/users.service.ts` (4)
- Modify: `src/users/dto/update-user.dto.ts` (5)
- Modify: `src/users/dto/list-users.dto.ts` (5)
- Modify: `src/users/dto/create-user.dto.ts` (2)
- Modify: `src/unidades/alcance-unidades.ts` (6)
- Modify: `src/unidades/unidades.service.ts` (4)

**Interfaces:**
- Consumes: `D`, `ACCESS_STATES`, `ACCESS_LEVELS`, `ROLE_LEVELS` de `src/domain`
- Produces: ningún cambio de firma pública. Es una sustitución de literales por constantes

- [ ] **Step 1: Confirmar la línea base**

Run: `pnpm test`
Expected: PASS con el mismo número de la Tarea 3

- [ ] **Step 2: Migrar archivo por archivo**

Para cada archivo de la lista, localiza los literales:

Run: `rg -n "'(sin_solicitud|pendiente|aprobado|rechazado|suspendido|super_admin|nacion|region|grupo|rama|adulto|protagonista|familia|manada|tropa|comunidad|clan)'" <archivo>`

Tabla de sustitución:

| Literal | Constante |
|---|---|
| `'sin_solicitud'` | `D.ACCESS_STATE.NO_REQUEST` |
| `'pendiente'` | `D.ACCESS_STATE.PENDING` |
| `'aprobado'` | `D.ACCESS_STATE.APPROVED` |
| `'rechazado'` | `D.ACCESS_STATE.REJECTED` |
| `'suspendido'` | `D.ACCESS_STATE.SUSPENDED` |
| `'super_admin'` | `D.ACCESS_LEVEL.SUPER_ADMIN` |
| `'nacion'` | `D.ACCESS_LEVEL.NACION` |
| `'region'` | `D.ACCESS_LEVEL.REGION` |
| `'grupo'` | `D.ACCESS_LEVEL.GRUPO` |
| `'rama'` (nivel de cargo) | `D.ROLE_LEVEL.RAMA` |
| `'adulto'` | `D.PERSON_TYPE.ADULT` |
| `'protagonista'` | `D.PERSON_TYPE.PROTAGONIST` |
| `'familia'`, `'manada'`, `'tropa'`, `'comunidad'`, `'clan'` | `D.BRANCH.FAMILIA` y equivalentes |

Cuando el literal es parte de una lista completa, usa la constante del grupo. En
`alcance-unidades.ts:27`:

```ts
const NIVELES_SIN_FILTRO: NivelAcceso[] = [
  D.ACCESS_LEVEL.SUPER_ADMIN,
  D.ACCESS_LEVEL.NACION,
  D.ACCESS_LEVEL.REGION,
];
```

Los strings de `AlcanceUnidades` (`'all'`, `'grupo'`, `'rama'`,
`'jefatura-requerida'`, `'sin-grupo'`) son un **discriminante de unión de tipos
interno**, no vocabulario del contrato: no se migran. Están tipados por la unión
y TypeScript ya los verifica. Añade a `alcance-unidades.ts` una excepción de
lint en línea si la regla los marca:

```ts
/* eslint-disable no-restricted-syntax -- discriminantes de la unión AlcanceUnidades, no vocabulario del manifiesto */
```

Ojo con `'rama'`: aparece con dos significados distintos. Como nivel de cargo va
a `D.ROLE_LEVEL.RAMA`; como discriminante de `AlcanceUnidades` se queda.

- [ ] **Step 3: Verificar tras cada archivo**

Run: `pnpm typecheck && pnpm test`
Expected: PASS. Hazlo archivo por archivo, no al final: si algo se rompe, quieres saber cuál fue.

- [ ] **Step 4: Commit**

```bash
git add src/users src/solicitudes-acceso src/unidades
git commit -m "refactor(domain): usuarios, solicitudes y unidades consumen el diccionario"
```

---

### Task 7: Migrar auth, powersync, correo, notificaciones, siscout y seeds

**Files:**
- Modify: `src/auth/auth.service.ts` (3)
- Modify: `src/powersync/powersync.service.ts` (2)
- Modify: `src/email/email.service.ts` (2)
- Modify: `src/email/email-notifier.port.ts` (1)
- Modify: `src/email/templates/solicitud-resuelta.tsx` (2)
- Modify: `src/notificaciones/adapters/notificador-outbox.ts` (1)
- Modify: `src/siscout/siscout-sync.service.ts` (1)
- Modify: `src/seeds/seed-super-admin.ts` (6)
- Modify: `src/tools/seed-mock-nacion.ts` (1)

**Interfaces:**
- Consumes: `D` de `src/domain`
- Produces: ningún cambio de firma pública

- [ ] **Step 1: Migrar archivo por archivo**

Para cada archivo:

Run: `rg -n "'(sin_solicitud|pendiente|aprobado|rechazado|suspendido|super_admin|nacion|region|grupo|rama|adulto|protagonista|familia|manada|tropa|comunidad|clan)'" <archivo>`

Tabla de sustitución:

| Literal | Constante |
|---|---|
| `'sin_solicitud'` | `D.ACCESS_STATE.NO_REQUEST` |
| `'pendiente'` | `D.ACCESS_STATE.PENDING` |
| `'aprobado'` | `D.ACCESS_STATE.APPROVED` |
| `'rechazado'` | `D.ACCESS_STATE.REJECTED` |
| `'suspendido'` | `D.ACCESS_STATE.SUSPENDED` |
| `'super_admin'` | `D.ACCESS_LEVEL.SUPER_ADMIN` |
| `'nacion'` | `D.ACCESS_LEVEL.NACION` |
| `'region'` | `D.ACCESS_LEVEL.REGION` |
| `'grupo'` | `D.ACCESS_LEVEL.GRUPO` |
| `'rama'` (nivel de cargo) | `D.ROLE_LEVEL.RAMA` |
| `'adulto'` | `D.PERSON_TYPE.ADULT` |
| `'protagonista'` | `D.PERSON_TYPE.PROTAGONIST` |
| `'familia'`, `'manada'`, `'tropa'`, `'comunidad'`, `'clan'` | `D.BRANCH.FAMILIA` y equivalentes |

`src/seeds/` y `src/tools/` están en la lista de `ignores` de la regla ESLint,
pero se migran igual: son código que se ejecuta contra datos reales y merece la
misma protección de tipos.

En `src/email/templates/solicitud-resuelta.tsx`, los literales que sean texto
visible del correo NO se migran: eso es contenido y vive en el catálogo i18n. Se
migran solo los que sean comparaciones o valores de estado.

- [ ] **Step 2: Verificar**

Run: `pnpm typecheck && pnpm test`
Expected: PASS con la línea base

- [ ] **Step 3: Commit**

```bash
git add src/auth src/powersync src/email src/notificaciones src/siscout src/seeds src/tools
git commit -m "refactor(domain): auth, correo, sync y seeds consumen el diccionario"
```

---

### Task 8: Activar el guard y cablear la verificación

**Files:**
- Modify: `eslint.config.mjs` (de `warn` a `error`)
- Modify: `package.json` (`verify` incluye `domain:check`)
- Modify: `README.md`

**Interfaces:**
- Consumes: todo lo anterior
- Produces: `pnpm verify` falla ante cualquier literal de dominio reintroducido

- [ ] **Step 1: Comprobar que no quedan avisos**

Run: `pnpm lint:check 2>&1 | rg -c 'Literal de dominio' || echo 0`
Expected: `0`

Si quedan avisos, migra esos sitios antes de continuar. Si alguno es un falso
positivo legítimo, añade un `eslint-disable-next-line no-restricted-syntax` con
el porqué en el mismo comentario, nunca sin justificación.

- [ ] **Step 2: Subir la regla a error**

En `eslint.config.mjs`, cambia `'no-restricted-syntax': ['warn',` por
`'no-restricted-syntax': ['error',`.

- [ ] **Step 3: Verificar que el lint pasa**

Run: `pnpm lint:check`
Expected: exit 0

- [ ] **Step 4: Verificar que el guard muerde**

Run:
```bash
printf "\nconst prueba = 'aprobado';\n" >> src/app.service.ts && pnpm lint:check; git checkout src/app.service.ts
```
Expected: el lint falla con `Literal de dominio en una asignación`, y el `git checkout` deja el archivo como estaba

- [ ] **Step 5: Cablear `domain:check` en `verify`**

En `package.json`:

```json
    "verify": "pnpm typecheck && pnpm lint:check && pnpm test && pnpm i18n:check && pnpm domain:check",
```

- [ ] **Step 6: Documentar en el README**

Añade a `README.md`, en la sección de comandos, estas dos líneas:

```markdown
- `pnpm domain:gen` regenera `src/domain/` y `.domain-vocabulary.json` desde `domain-manifest.json`.
- `pnpm domain:check` verifica que lo generado está al día y que el manifiesto coincide con el de fe_ruta.
```

Y una nota breve: el vocabulario del dominio se edita SOLO en
`domain-manifest.json`; `src/domain/` es generado y no se toca a mano.

- [ ] **Step 7: Verificación final completa**

Run: `pnpm verify`
Expected: typecheck, lint, tests, i18n y domain, todo en verde

- [ ] **Step 8: Confirmar el criterio de aceptación**

Run:
```bash
rg -c --glob '!*.spec.ts' --glob '!src/domain/**' -e "'(sin_solicitud|pendiente|aprobado|rechazado|suspendido|super_admin|nacion|region|grupo|rama|adulto|protagonista|familia|manada|tropa|comunidad|clan)'" src || echo 'sin literales de dominio'
```
Expected: solo los sitios con `eslint-disable` justificado (los discriminantes de `AlcanceUnidades`) o `sin literales de dominio`

- [ ] **Step 9: Commit**

```bash
git add eslint.config.mjs package.json README.md
git commit -m "feat(domain): el guard de literales pasa a bloqueante y entra en verify"
```

---

## Criterios de aceptación de la Fase 1

- `pnpm verify` en verde.
- `pnpm domain:check` falla si se edita `src/domain/` a mano.
- `pnpm lint:check` falla ante un literal de dominio reintroducido en `src/`.
- No quedan listas duplicadas de niveles: `NIVELES_ACCESO`, `NIVELES_CARGO` y `NIVELES_SOLICITUD` derivan todas del manifiesto.
- `ETIQUETA_RAMA` ya no existe; las etiquetas de rama salen del catálogo i18n.
- El número de tests es igual o mayor que la línea base, y ninguno se saltó.
