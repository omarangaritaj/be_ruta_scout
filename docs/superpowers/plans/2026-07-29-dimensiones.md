# Dimensiones (growth-items) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la sección de administración "Dimensiones": un catálogo por rama y área de crecimiento con CRUD, permisos propios y semilla de 93 items del marco educativo.

**Architecture:** Vocabulario nuevo (7 áreas de crecimiento y el mapa rama → áreas) entra por `domain-manifest.json` y sale generado a `domain/` en los dos repos. El backend expone `src/growth-items/`, un módulo espejo de `src/questions/` con una regla extra (el área tiene que pertenecer a la rama) y un índice único que hace idempotente la semilla. El frontend replica `/admin/preguntas` en `/admin/dimensiones`, con el rótulo del campo derivado de la rama.

**Tech Stack:** be_ruta — NestJS 11, Mongoose, zod, jest. fe_ruta — Next.js 16 (App Router), React Server Components, shadcn base-mira (Base UI), vitest.

**Spec:** `be_ruta/docs/superpowers/specs/2026-07-29-dimensiones-design.md`

## Global Constraints

- **pnpm SIEMPRE**, nunca npm, en los dos repos.
- **Los dos repos están en la rama `dimension`.** No crear ramas nuevas.
- **`domain-manifest.json` es idéntico byte a byte entre repos.** `pnpm domain:check` compara SHA-256 y rompe si divergen. Copiar con `cp`, nunca reescribir a mano en los dos lados.
- **`domain/` es generado.** Nunca editar `be_ruta/src/domain/*` ni `fe_ruta/lib/domain/*` a mano, salvo `routes.ts` y `endpoints.ts` del frontend, que sí son escritos a mano.
- **Los dos `scripts/domain-codegen.ts` NO son idénticos** (be usa comillas simples y genera a `src/domain/`; fe usa comillas dobles y genera a `lib/domain/`). Se editan por separado.
- **Identificadores en inglés**, textos de usuario en español desde el catálogo i18n. Nunca hardcodear texto visible.
- **Sin comentarios** salvo un *por qué* no evidente.
- **Nunca em dashes** en texto de cara al usuario. Guion, dos puntos o paréntesis.
- **Conventional Commits en español con scope.** NUNCA co-authors ni "Generated with".
- **No tocar `fe_ruta/components/ui/`.** Es el banco de shadcn y no se poda.
- Estilo: be_ruta comillas simples, fe_ruta comillas dobles. Prettier decide el resto.

---

### Task 1: Áreas de crecimiento en el manifiesto de dominio

Añade el vocabulario nuevo y el mapa rama → áreas a los dos repos, con su guardia en el generador.

**Files:**
- Modify: `be_ruta/domain-manifest.json`
- Modify: `fe_ruta/domain-manifest.json` (copia byte a byte del anterior)
- Modify: `be_ruta/scripts/domain-codegen.ts`
- Modify: `fe_ruta/scripts/domain-codegen.ts`
- Test: `be_ruta/scripts/domain-codegen.spec.ts`
- Test: `fe_ruta/scripts/domain-codegen.test.ts`
- Modify: `fe_ruta/lib/i18n/catalogo.ts`
- Generated: `be_ruta/src/domain/growth-areas.ts`, `fe_ruta/lib/domain/growth-areas.ts` (los produce `pnpm domain:gen`, no los escribas)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `GROWTH_AREAS: readonly GrowthArea[]` y `type GrowthArea` — los 7 valores.
  - `GROWTH_AREA_MESSAGE_KEY: Record<GrowthArea, string>`
  - `BRANCH_GROWTH_AREAS: Record<Branch, readonly GrowthArea[]>`
  - `growthAreasOf(branch: Branch): readonly GrowthArea[]`
  - `D.GROWTH_AREA.{CORPORALIDAD,...}` en el diccionario.
  - Todo exportado desde `../domain` (be) y `@/lib/domain` (fe).

- [ ] **Step 1: Escribir el test del guard en be_ruta**

En `be_ruta/scripts/domain-codegen.spec.ts`, añade `growthAreas: []` al objeto `vacio`, añade `growthAreas: ['corporalidad']` a la rama MANADA del `MANIFEST` y `growthAreas: [{ name: 'CORPORALIDAD', value: 'corporalidad' }]` al `MANIFEST`. Luego agrega estos tests:

```ts
describe('áreas de crecimiento', () => {
  function manifestCon(branchAreas: string[], growthAreas = ['corporalidad']) {
    return JSON.stringify({
      ...JSON.parse(vacioSerializado),
      growthAreas: growthAreas.map((value) => ({
        name: value.toUpperCase(),
        value,
      })),
      branches: [
        {
          name: 'MANADA',
          value: 'manada',
          order: 2,
          siscoutAliases: ['MANADA'],
          ageRange: [0, 9],
          growthAreas: branchAreas,
        },
      ],
    });
  }

  it('rechaza un área que no existe en el catálogo', () => {
    expect(() => readManifest(manifestCon(['inventada']))).toThrow(
      /inexistente/,
    );
  });

  it('rechaza un área repetida en la misma rama', () => {
    expect(() =>
      readManifest(manifestCon(['corporalidad', 'corporalidad'])),
    ).toThrow(/repetida/);
  });

  it('rechaza una rama sin áreas', () => {
    expect(() => readManifest(manifestCon([]))).toThrow(/sin áreas/);
  });

  it('genera el mapa de rama a áreas', () => {
    const manifest = readManifest(manifestCon(['corporalidad']));
    const archivo = generateFiles(manifest).get('src/domain/growth-areas.ts');

    expect(archivo).toContain("manada: ['corporalidad'],");
    expect(archivo).toContain('export function growthAreasOf(');
  });
});
```

Declara `const vacioSerializado = JSON.stringify(vacio);` junto al objeto `vacio` existente.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd be_ruta && pnpm test -- domain-codegen`
Expected: FAIL. Los tests de rechazo fallan porque `readManifest` todavía no valida nada, y el de generación falla con `undefined` porque `growth-areas.ts` no se genera.

- [ ] **Step 3: Extender los tipos del manifiesto en be_ruta**

En `be_ruta/scripts/domain-codegen.ts`, añade `growthAreas: string[];` a `BranchEntry` y `growthAreas: NamedValue[];` a `DomainManifest`.

- [ ] **Step 4: Escribir el guard y engancharlo en be_ruta**

Añade la función antes de `readManifest`:

```ts
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
        throw new Error(
          `Área de crecimiento inexistente en ${value}: ${area}`,
        );
      }
      if (vistas.has(area)) {
        throw new Error(`Área de crecimiento repetida en ${value}: ${area}`);
      }
      vistas.add(area);
    }
  }
}
```

Dentro de `readManifest`, junto a las demás aserciones:

```ts
assertUnique(ordenado.growthAreas, 'growthAreas');
assertBranchGrowthAreas(ordenado.branches, ordenado.growthAreas);
```

- [ ] **Step 5: Generar `growth-areas.ts` en be_ruta**

Añade el bloque generador antes de `generateFiles`:

No uses el helper `quoted()`: en el backend une con `', '` pero en el frontend une con `",\n  "`, y copiar el bloque entre repos rompería el formato. Escribe las comillas a mano.

```ts
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
```

Dentro de `generateFiles`, después del bloque de `src/domain/diagnostic.ts`:

```ts
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
```

En el bloque de `src/domain/dictionary.ts`, añade tras `dictionaryGroup('DIAGNOSTIC_BLOCK', ...)`:

```ts
dictionaryGroup('GROWTH_AREA', manifest.growthAreas) +
```

En el bloque de `src/domain/index.ts`, añade la línea en orden alfabético (después de `'./errors'`):

```ts
"export * from './growth-areas';\n" +
```

En el array `vocabulario`, añade `...manifest.growthAreas,` tras `...manifest.diagnosticBlocks,`.

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `cd be_ruta && pnpm test -- domain-codegen`
Expected: PASS.

- [ ] **Step 7: Escribir el manifiesto real en be_ruta**

En `be_ruta/domain-manifest.json`, añade el bloque `growthAreas` justo después de `diagnosticBlocks`:

```json
  "growthAreas": [
    { "name": "CORPORALIDAD", "value": "corporalidad" },
    { "name": "CREATIVIDAD", "value": "creatividad" },
    { "name": "CARACTER", "value": "caracter" },
    { "name": "AFECTIVIDAD", "value": "afectividad" },
    { "name": "SOCIABILIDAD", "value": "sociabilidad" },
    { "name": "ESPIRITUALIDAD", "value": "espiritualidad" },
    { "name": "SOCIOAFECTIVIDAD", "value": "socioafectividad" }
  ],
```

Y añade `growthAreas` a cada rama. Familia lleva las cinco suyas:

```json
    {
      "name": "FAMILIA",
      "value": "familia",
      "order": 1,
      "siscoutAliases": ["FAMILIA", "CACHORRO", "CACHORROS"],
      "ageRange": [0, 6],
      "growthAreas": [
        "corporalidad",
        "creatividad",
        "caracter",
        "socioafectividad",
        "espiritualidad"
      ]
    },
```

Manada, Tropa, Comunidad y Clan llevan las seis clásicas (el mismo array en las cuatro):

```json
      "growthAreas": [
        "corporalidad",
        "creatividad",
        "caracter",
        "afectividad",
        "sociabilidad",
        "espiritualidad"
      ]
```

- [ ] **Step 8: Generar y verificar en be_ruta**

Run: `cd be_ruta && pnpm domain:gen && pnpm exec tsc --noEmit`
Expected: escribe `src/domain/growth-areas.ts` con las 7 áreas y el mapa; tsc sin errores.

Inspecciona el archivo generado: `growthAreasOf('familia')` debe listar `socioafectividad` y NO `afectividad`.

- [ ] **Step 9: Replicar el codegen en fe_ruta**

Repite los pasos 3, 4 y 5 en `fe_ruta/scripts/domain-codegen.ts`, con **comillas dobles** y ruta `lib/domain/growth-areas.ts`:

```ts
archivos.set(
  "lib/domain/growth-areas.ts",
  HEADER +
    'import type { Branch } from "./branches";\n\n' +
    constAndType("GROWTH_AREAS", "GrowthArea", manifest.growthAreas) +
    messageKeyMap(
      "GROWTH_AREA_MESSAGE_KEY",
      "GROWTH_AREA",
      manifest.growthAreas,
    ) +
    branchGrowthAreasBlock(manifest.branches),
);
```

En `branchGrowthAreasBlock` del frontend cambia las comillas del literal por dobles:

```ts
    .map(
      (b) =>
        `  ${b.value}: [${b.growthAreas.map((a) => `"${a}"`).join(", ")}],`,
    )
```

Añade también `dictionaryGroup("GROWTH_AREA", manifest.growthAreas) +`, la línea `'export * from "./growth-areas";\n' +` en `index.ts` (en orden alfabético, tras `"./errors"`) y `...manifest.growthAreas,` al `vocabulario`.

- [ ] **Step 10: Escribir el test equivalente en fe_ruta**

En `fe_ruta/scripts/domain-codegen.test.ts`, añade `growthAreas: []` al objeto `vacio` y replica el `describe` del Step 1, con dos cambios: el import de vitest ya existe arriba y la ruta del archivo generado es `lib/domain/growth-areas.ts`. La aserción de contenido usa comillas dobles:

```ts
expect(archivo).toContain('manada: ["corporalidad"],');
```

- [ ] **Step 11: Copiar el manifiesto y generar en fe_ruta**

Run:
```bash
cp be_ruta/domain-manifest.json fe_ruta/domain-manifest.json
cd fe_ruta && pnpm domain:gen
```
Expected: escribe `lib/domain/growth-areas.ts`.

- [ ] **Step 12: Añadir las etiquetas de las áreas al catálogo del frontend**

`GROWTH_AREA_MESSAGE_KEY` apunta a claves que tienen que existir, o `t()` no compila. En `fe_ruta/lib/i18n/catalogo.ts`, inserta el dominio `GROWTH_AREA` en orden alfabético (va después de `DISENO` y antes de la siguiente clave):

```ts
  GROWTH_AREA: {
    AFECTIVIDAD: "Afectividad",
    CARACTER: "Carácter",
    CORPORALIDAD: "Corporalidad",
    CREATIVIDAD: "Creatividad",
    ESPIRITUALIDAD: "Espiritualidad",
    SOCIABILIDAD: "Sociabilidad",
    SOCIOAFECTIVIDAD: "Socioafectividad",
  },
```

El backend NO necesita estas claves: genera `GROWTH_AREA_MESSAGE_KEY` pero no lo usa, igual que ya pasa hoy con `DIAGNOSTIC_BLOCK_MESSAGE_KEY`, que tampoco tiene entrada en `be_ruta/src/i18n/catalog.ts`.

- [ ] **Step 13: Verificar los dos repos**

Run:
```bash
cd be_ruta && pnpm domain:check && pnpm test -- domain-codegen && pnpm lint:check
cd ../fe_ruta && pnpm domain:check && pnpm test -- domain-codegen && pnpm exec tsc --noEmit && pnpm i18n:check
```
Expected: todo en verde. `domain:check` confirma que los dos manifiestos tienen el mismo SHA-256.

- [ ] **Step 14: Commit en los dos repos**

```bash
cd be_ruta
git add domain-manifest.json scripts/domain-codegen.ts scripts/domain-codegen.spec.ts src/domain/
git commit -m "feat(domain): añade las áreas de crecimiento y su mapa por rama"

cd ../fe_ruta
git add domain-manifest.json scripts/domain-codegen.ts scripts/domain-codegen.test.ts lib/domain/ lib/i18n/catalogo.ts
git commit -m "feat(domain): añade las áreas de crecimiento y su mapa por rama"
```

---

### Task 2: Permisos `growth-item`, ruta de administración y comodín con guion

Registra los cuatro permisos y arregla el validador que hoy rechazaría `growth-item:*`.

**Files:**
- Modify: `be_ruta/domain-manifest.json`
- Modify: `fe_ruta/domain-manifest.json` (copia)
- Modify: `be_ruta/src/authz/permissions.catalog.ts:115`
- Test: `be_ruta/src/authz/permissions.catalog.spec.ts`

**Interfaces:**
- Consumes: nada de la Task 1.
- Produces: las claves `growth-item:read`, `growth-item:create`, `growth-item:update`, `growth-item:delete` en `PERMISSION_KEYS` y `FRONTEND_PERMISSION_KEYS`; la entrada `/admin/dimensiones` en `ROUTE_RESOURCES`.

- [ ] **Step 1: Escribir el test que prueba el fix del regex**

En `be_ruta/src/authz/permissions.catalog.spec.ts`, dentro del test `'acepta el comodín de recurso'`, añade:

```ts
    expect(isValidPermission('growth-item:*')).toBe(true);
    expect(isValidPermission('growth-item:read')).toBe(true);
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd be_ruta && pnpm test -- permissions.catalog`
Expected: FAIL en `growth-item:*` (recibe `false`). El regex `/^([a-z]+):\*$/` no acepta el guion. `growth-item:read` también falla mientras la clave no esté en el manifiesto.

- [ ] **Step 3: Arreglar el regex**

En `be_ruta/src/authz/permissions.catalog.ts:115`:

```ts
  const recursoWildcard = /^([a-z][a-z-]*):\*$/.exec(value);
```

- [ ] **Step 4: Registrar los permisos y la ruta en el manifiesto**

En `be_ruta/domain-manifest.json`, dentro de `permissions`, tras el bloque de `question:*`:

```json
    { "key": "growth-item:read", "side": "both" },
    { "key": "growth-item:create", "side": "both" },
    { "key": "growth-item:update", "side": "both" },
    { "key": "growth-item:delete", "side": "both" },
```

Y en `routeResources`, tras la entrada de `/admin/preguntas`:

```json
    { "path": "/admin/dimensiones", "label": "Dimensiones", "section": "Administración" }
```

Cuida la coma: `/admin/preguntas` deja de ser el último elemento del array.

- [ ] **Step 5: Describir los permisos en el catálogo**

En `be_ruta/src/authz/permissions.catalog.ts`, tras el bloque de `question:*`:

```ts
  {
    key: 'growth-item:read',
    descripcion: 'Ver dimensiones y competencias',
    lado: 'ambos',
  },
  {
    key: 'growth-item:create',
    descripcion: 'Crear dimensiones y competencias',
    lado: 'ambos',
  },
  {
    key: 'growth-item:update',
    descripcion: 'Editar dimensiones y competencias',
    lado: 'ambos',
  },
  {
    key: 'growth-item:delete',
    descripcion: 'Eliminar dimensiones y competencias',
    lado: 'ambos',
  },
```

El test `'describe exactamente los permisos del dominio'` compara esta lista con `PERMISSION_KEYS`: si olvidas una descripción, falla.

- [ ] **Step 6: Generar y correr los tests**

Run:
```bash
cd be_ruta && pnpm domain:gen && pnpm test -- permissions.catalog
```
Expected: PASS.

- [ ] **Step 7: Sincronizar el frontend**

Run:
```bash
cp be_ruta/domain-manifest.json fe_ruta/domain-manifest.json
cd fe_ruta && pnpm domain:gen && pnpm exec tsc --noEmit && pnpm domain:check
```
Expected: `lib/domain/permissions.ts` y `route-resources.ts` regenerados, tsc limpio, SHA parejo.

- [ ] **Step 8: Commit en los dos repos**

```bash
cd be_ruta
git add domain-manifest.json src/authz/ src/domain/
git commit -m "feat(authz): añade los permisos de dimensiones y admite recursos con guion"

cd ../fe_ruta
git add domain-manifest.json lib/domain/
git commit -m "feat(authz): añade los permisos de dimensiones"
```

---

### Task 3: Módulo `growth-items` en el backend

CRUD completo con soft-delete, la regla rama↔área y el índice único.

**Files:**
- Create: `be_ruta/src/growth-items/schemas/growth-item.schema.ts`
- Create: `be_ruta/src/growth-items/growth-item-rules.ts`
- Create: `be_ruta/src/growth-items/growth-item-rules.spec.ts`
- Create: `be_ruta/src/growth-items/dto/growth-item-base.schema.ts`
- Create: `be_ruta/src/growth-items/dto/create-growth-item.dto.ts`
- Create: `be_ruta/src/growth-items/dto/update-growth-item.dto.ts`
- Create: `be_ruta/src/growth-items/dto/list-growth-items.dto.ts`
- Create: `be_ruta/src/growth-items/growth-items.service.ts`
- Create: `be_ruta/src/growth-items/growth-items.service.spec.ts`
- Create: `be_ruta/src/growth-items/growth-items.controller.ts`
- Create: `be_ruta/src/growth-items/growth-items.module.ts`
- Modify: `be_ruta/src/app.module.ts`
- Modify: `be_ruta/src/i18n/catalog.ts`

**Interfaces:**
- Consumes: `BRANCHES`, `GROWTH_AREAS`, `growthAreasOf`, `type Branch`, `type GrowthArea` de `../domain` (Task 1). Permisos de la Task 2.
- Produces:
  - `GrowthItem` / `GrowthItemDocument` con `{ branch, growthArea, text, order, isActive }`.
  - `GrowthItemsService.findAll(branch?, growthArea?, includeInactive?)`, `.create(dto)`, `.update(id, dto)`, `.remove(id)`.
  - `assertAreaBelongsToBranch(branch, growthArea): void`.
  - Endpoints `GET|POST /growth-items`, `PATCH|DELETE /growth-items/:id`.

- [ ] **Step 1: Escribir el test de la regla rama↔área**

Crea `be_ruta/src/growth-items/growth-item-rules.spec.ts`:

```ts
import { AppBadRequestException } from '../common';
import { assertAreaBelongsToBranch } from './growth-item-rules';

describe('assertAreaBelongsToBranch', () => {
  it('acepta un área que la rama sí usa', () => {
    expect(() =>
      assertAreaBelongsToBranch('tropa', 'afectividad'),
    ).not.toThrow();
  });

  it('acepta socioafectividad en familia', () => {
    expect(() =>
      assertAreaBelongsToBranch('familia', 'socioafectividad'),
    ).not.toThrow();
  });

  it('rechaza afectividad en familia', () => {
    expect(() =>
      assertAreaBelongsToBranch('familia', 'afectividad'),
    ).toThrow(AppBadRequestException);
  });

  it('rechaza socioafectividad fuera de familia', () => {
    expect(() =>
      assertAreaBelongsToBranch('tropa', 'socioafectividad'),
    ).toThrow(AppBadRequestException);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd be_ruta && pnpm test -- growth-item-rules`
Expected: FAIL, no existe el módulo.

- [ ] **Step 3: Implementar la regla**

Crea `be_ruta/src/growth-items/growth-item-rules.ts`:

```ts
import { AppBadRequestException } from '../common';
import { growthAreasOf, type Branch, type GrowthArea } from '../domain';
import { K } from '../i18n';

export function assertAreaBelongsToBranch(
  branch: Branch,
  growthArea: GrowthArea,
): void {
  if (growthAreasOf(branch).includes(growthArea)) return;
  throw new AppBadRequestException(K.GROWTH_ITEMS.AREA_NOT_IN_BRANCH, {
    area: growthArea,
    rama: branch,
  });
}
```

- [ ] **Step 4: Añadir las claves al catálogo del backend**

En `be_ruta/src/i18n/catalog.ts`, inserta el dominio entre `GROUPS` y `PASSWORD_RESET` (las claves van en orden alfabético):

```ts
  GROWTH_ITEMS: {
    AREA_NOT_IN_BRANCH:
      'El área "{area}" no corresponde a la rama "{rama}"',
    NOT_FOUND: 'No existe una dimensión con id "{id}"',
    ORDER_TAKEN:
      'Ya hay una dimensión con el orden {order} en esa rama y área',
  },
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd be_ruta && pnpm test -- growth-item-rules`
Expected: PASS.

- [ ] **Step 6: Crear el schema**

Crea `be_ruta/src/growth-items/schemas/growth-item.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  BRANCHES,
  GROWTH_AREAS,
  type Branch,
  type GrowthArea,
} from '../../domain';

export type GrowthItemDocument = HydratedDocument<GrowthItem>;

@Schema({ collection: 'growth_items', timestamps: true })
export class GrowthItem {
  @Prop({ type: String, enum: BRANCHES, required: true })
  branch: Branch;

  @Prop({ type: String, enum: GROWTH_AREAS, required: true })
  growthArea: GrowthArea;

  @Prop({ required: true, trim: true })
  text: string;

  @Prop({ type: Number, required: true })
  order: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const GrowthItemSchema = SchemaFactory.createForClass(GrowthItem);

GrowthItemSchema.index(
  { branch: 1, growthArea: 1, order: 1 },
  { unique: true },
);
```

- [ ] **Step 7: Crear los DTO**

`be_ruta/src/growth-items/dto/growth-item-base.schema.ts`:

```ts
import { z } from 'zod';
import { BRANCHES, GROWTH_AREAS } from '../../domain';
import { K, t } from '../../i18n';

export const growthItemBaseSchema = z.object({
  branch: z.enum(BRANCHES, { error: t(K.VALIDATION.INVALID_INPUT) }),
  growthArea: z.enum(GROWTH_AREAS, { error: t(K.VALIDATION.INVALID_INPUT) }),
  text: z
    .string()
    .trim()
    .min(1, { error: t(K.VALIDATION.INVALID_INPUT) }),
  order: z.number().int(),
  isActive: z.boolean().optional(),
});
```

`be_ruta/src/growth-items/dto/create-growth-item.dto.ts`:

```ts
import { z } from 'zod';
import { growthItemBaseSchema } from './growth-item-base.schema';

export const createGrowthItemSchema = growthItemBaseSchema.omit({
  isActive: true,
});

export type CreateGrowthItemDto = z.infer<typeof createGrowthItemSchema>;
```

`be_ruta/src/growth-items/dto/update-growth-item.dto.ts`:

```ts
import { z } from 'zod';
import { K, t } from '../../i18n';
import { growthItemBaseSchema } from './growth-item-base.schema';

export const updateGrowthItemSchema = growthItemBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: t(K.VALIDATION.AT_LEAST_ONE_FIELD),
  });

export type UpdateGrowthItemDto = z.infer<typeof updateGrowthItemSchema>;
```

`be_ruta/src/growth-items/dto/list-growth-items.dto.ts`:

```ts
import { z } from 'zod';
import { BRANCHES, GROWTH_AREAS } from '../../domain';
import { K, t } from '../../i18n';

export const listGrowthItemsSchema = z.object({
  branch: z.enum(BRANCHES, { error: t(K.VALIDATION.INVALID_INPUT) }).optional(),
  growthArea: z
    .enum(GROWTH_AREAS, { error: t(K.VALIDATION.INVALID_INPUT) })
    .optional(),
  includeInactive: z
    .stringbool({ error: t(K.VALIDATION.INVALID_INPUT) })
    .optional(),
});

export type ListGrowthItemsDto = z.infer<typeof listGrowthItemsSchema>;
```

- [ ] **Step 8: Escribir el test del service**

Crea `be_ruta/src/growth-items/growth-items.service.spec.ts`:

```ts
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import {
  AppBadRequestException,
  AppConflictException,
  AppNotFoundException,
} from '../common';
import { GrowthItem } from './schemas/growth-item.schema';
import { GrowthItemsService } from './growth-items.service';

function modelMock() {
  const chain = { sort: jest.fn().mockReturnValue({ exec: jest.fn() }) };
  return {
    find: jest.fn().mockReturnValue(chain),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    create: jest.fn(),
    chain,
  };
}

function duplicateKeyError() {
  return Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
}

describe('GrowthItemsService', () => {
  let service: GrowthItemsService;
  let model: ReturnType<typeof modelMock>;

  beforeEach(async () => {
    model = modelMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        GrowthItemsService,
        { provide: getModelToken(GrowthItem.name), useValue: model },
      ],
    }).compile();
    service = moduleRef.get(GrowthItemsService);
    model.chain.sort.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
  });

  it('lista solo las activas por defecto', async () => {
    await service.findAll();

    expect(model.find).toHaveBeenCalledWith({ isActive: true });
  });

  it('filtra por rama y área', async () => {
    await service.findAll('tropa', 'afectividad');

    expect(model.find).toHaveBeenCalledWith({
      isActive: true,
      branch: 'tropa',
      growthArea: 'afectividad',
    });
  });

  it('ordena por rama, área y orden', async () => {
    await service.findAll();

    expect(model.chain.sort).toHaveBeenCalledWith({
      branch: 1,
      growthArea: 1,
      order: 1,
    });
  });

  it('crea cuando el área corresponde a la rama', async () => {
    model.create.mockResolvedValue({ id: 'abc' });

    await service.create({
      branch: 'tropa',
      growthArea: 'afectividad',
      text: 'Competencia',
      order: 1,
    });

    expect(model.create).toHaveBeenCalled();
  });

  it('rechaza crear con un área ajena a la rama', async () => {
    await expect(
      service.create({
        branch: 'familia',
        growthArea: 'afectividad',
        text: 'Dimensión',
        order: 1,
      }),
    ).rejects.toBeInstanceOf(AppBadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('traduce el orden duplicado a conflicto', async () => {
    model.create.mockRejectedValue(duplicateKeyError());

    await expect(
      service.create({
        branch: 'tropa',
        growthArea: 'afectividad',
        text: 'Competencia',
        order: 1,
      }),
    ).rejects.toBeInstanceOf(AppConflictException);
  });

  it('valida el área del update contra la rama ya guardada', async () => {
    model.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ branch: 'familia' }),
    });

    await expect(
      service.update('abc', { growthArea: 'afectividad' }),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('desactiva en lugar de borrar', async () => {
    model.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ id: 'abc' }),
    });

    await service.remove('abc');

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith('abc', {
      isActive: false,
    });
  });

  it('falla al desactivar una dimensión inexistente', async () => {
    model.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.remove('abc')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });
});
```

- [ ] **Step 9: Correr el test y verificar que falla**

Run: `cd be_ruta && pnpm test -- growth-items.service`
Expected: FAIL, no existe el service.

- [ ] **Step 10: Implementar el service**

Crea `be_ruta/src/growth-items/growth-items.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConflictException, AppNotFoundException } from '../common';
import { type Branch, type GrowthArea } from '../domain';
import { K } from '../i18n';
import { CreateGrowthItemDto } from './dto/create-growth-item.dto';
import { UpdateGrowthItemDto } from './dto/update-growth-item.dto';
import { assertAreaBelongsToBranch } from './growth-item-rules';
import { GrowthItem, GrowthItemDocument } from './schemas/growth-item.schema';

const DUPLICATE_KEY = 11000;

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === DUPLICATE_KEY
  );
}

@Injectable()
export class GrowthItemsService {
  constructor(
    @InjectModel(GrowthItem.name)
    private readonly growthItemModel: Model<GrowthItemDocument>,
  ) {}

  async findAll(
    branch?: Branch,
    growthArea?: GrowthArea,
    includeInactive = false,
  ): Promise<GrowthItemDocument[]> {
    const filter: Record<string, unknown> = includeInactive
      ? {}
      : { isActive: true };
    if (branch) filter.branch = branch;
    if (growthArea) filter.growthArea = growthArea;
    return this.growthItemModel
      .find(filter)
      .sort({ branch: 1, growthArea: 1, order: 1 })
      .exec();
  }

  async create(dto: CreateGrowthItemDto): Promise<GrowthItemDocument> {
    assertAreaBelongsToBranch(dto.branch, dto.growthArea);
    try {
      return await this.growthItemModel.create(dto);
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppConflictException(K.GROWTH_ITEMS.ORDER_TAKEN, {
          order: dto.order,
        });
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateGrowthItemDto,
  ): Promise<GrowthItemDocument> {
    if (dto.branch || dto.growthArea) {
      const current = await this.growthItemModel.findById(id).exec();
      if (!current) {
        throw new AppNotFoundException(K.GROWTH_ITEMS.NOT_FOUND, { id });
      }
      assertAreaBelongsToBranch(
        dto.branch ?? current.branch,
        dto.growthArea ?? current.growthArea,
      );
    }

    try {
      const updated = await this.growthItemModel
        .findByIdAndUpdate(id, dto, { new: true })
        .exec();
      if (!updated) {
        throw new AppNotFoundException(K.GROWTH_ITEMS.NOT_FOUND, { id });
      }
      return updated;
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppConflictException(K.GROWTH_ITEMS.ORDER_TAKEN, {
          order: dto.order,
        });
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const updated = await this.growthItemModel
      .findByIdAndUpdate(id, { isActive: false })
      .exec();
    if (!updated) {
      throw new AppNotFoundException(K.GROWTH_ITEMS.NOT_FOUND, { id });
    }
  }
}
```

- [ ] **Step 11: Correr el test y verificar que pasa**

Run: `cd be_ruta && pnpm test -- growth-items.service`
Expected: PASS, los 9 tests.

- [ ] **Step 12: Crear el controller y el module**

`be_ruta/src/growth-items/growth-items.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/require-permissions.decorator';
import { ParseObjectIdPipe, ZodValidationPipe } from '../common';
import {
  createGrowthItemSchema,
  type CreateGrowthItemDto,
} from './dto/create-growth-item.dto';
import {
  listGrowthItemsSchema,
  type ListGrowthItemsDto,
} from './dto/list-growth-items.dto';
import {
  updateGrowthItemSchema,
  type UpdateGrowthItemDto,
} from './dto/update-growth-item.dto';
import { GrowthItemDocument } from './schemas/growth-item.schema';
import { GrowthItemsService } from './growth-items.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('growth-items')
export class GrowthItemsController {
  constructor(private readonly growthItemsService: GrowthItemsService) {}

  @Get()
  @RequirePermissions('growth-item:read')
  async findAll(
    @Query(new ZodValidationPipe(listGrowthItemsSchema))
    query: ListGrowthItemsDto,
  ): Promise<GrowthItemDocument[]> {
    return this.growthItemsService.findAll(
      query.branch,
      query.growthArea,
      query.includeInactive,
    );
  }

  @Post()
  @RequirePermissions('growth-item:create')
  async create(
    @Body(new ZodValidationPipe(createGrowthItemSchema))
    dto: CreateGrowthItemDto,
  ): Promise<GrowthItemDocument> {
    return this.growthItemsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('growth-item:update')
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateGrowthItemSchema))
    dto: UpdateGrowthItemDto,
  ): Promise<GrowthItemDocument> {
    return this.growthItemsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('growth-item:delete')
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.growthItemsService.remove(id);
  }
}
```

`be_ruta/src/growth-items/growth-items.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GrowthItem, GrowthItemSchema } from './schemas/growth-item.schema';
import { GrowthItemsController } from './growth-items.controller';
import { GrowthItemsService } from './growth-items.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GrowthItem.name, schema: GrowthItemSchema },
    ]),
  ],
  controllers: [GrowthItemsController],
  providers: [GrowthItemsService],
  exports: [GrowthItemsService, MongooseModule],
})
export class GrowthItemsModule {}
```

- [ ] **Step 13: Registrar el módulo en la app**

En `be_ruta/src/app.module.ts`, añade el import junto a los demás:

```ts
import { GrowthItemsModule } from './growth-items/growth-items.module';
```

Y añade `GrowthItemsModule,` al array `imports`, junto a `QuestionsModule`.

- [ ] **Step 14: Verificar la suite completa**

Run: `cd be_ruta && pnpm exec tsc --noEmit && pnpm lint:check && pnpm test`
Expected: todo verde.

- [ ] **Step 15: Commit**

```bash
cd be_ruta
git add src/growth-items/ src/app.module.ts src/i18n/catalog.ts
git commit -m "feat(growth-items): expone el CRUD del catálogo de dimensiones"
```

---

### Task 4: Extraer el catálogo legado a JSON

Convierte el catálogo del entorno v0.6.2 en datos versionados. Se corre una vez; el JSON queda en el repo.

**Files:**
- Create: `be_ruta/scripts/extract-growth-items.ts`
- Create: `be_ruta/src/seeds/data/growth-items.json` (lo produce el script)
- Create: `be_ruta/src/seeds/data/growth-items.spec.ts`
- Modify: `be_ruta/package.json`

**Interfaces:**
- Consumes: `GROWTH_AREAS`, `BRANCHES`, `growthAreasOf` de `../src/domain` (Task 1).
- Produces: `growth-items.json` como `Array<{ branch, growthArea, order, text }>` con 93 entradas. La Task 5 lo importa.

- [ ] **Step 1: Escribir el test de forma del catálogo**

Crea `be_ruta/src/seeds/data/growth-items.spec.ts`:

```ts
import { BRANCHES, growthAreasOf, type Branch } from '../../domain';
import catalog from './growth-items.json';

describe('catálogo semilla de dimensiones', () => {
  it('trae los 93 items del marco educativo', () => {
    expect(catalog).toHaveLength(93);
  });

  it('cubre las cinco ramas', () => {
    const ramas = new Set(catalog.map((item) => item.branch));

    expect([...ramas].sort()).toEqual([...BRANCHES].sort());
  });

  it('usa solo áreas que la rama admite', () => {
    for (const item of catalog) {
      expect(growthAreasOf(item.branch as Branch)).toContain(item.growthArea);
    }
  });

  it('numera el orden desde 1 y sin huecos dentro de cada rama y área', () => {
    const grupos = new Map<string, number[]>();
    for (const item of catalog) {
      const clave = `${item.branch}/${item.growthArea}`;
      grupos.set(clave, [...(grupos.get(clave) ?? []), item.order]);
    }

    for (const [clave, ordenes] of grupos) {
      const esperado = ordenes.map((_, index) => index + 1);
      expect([...ordenes].sort((a, b) => a - b)).toEqual(esperado);
      expect(clave).toBeTruthy();
    }
  });

  it('no trae textos vacíos', () => {
    for (const item of catalog) {
      expect(item.text.trim().length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd be_ruta && pnpm test -- growth-items.json`
Expected: FAIL, el JSON no existe.

Si jest se queja de importar JSON, confirma que `tsconfig.json` tiene `"resolveJsonModule": true`. Si no lo tiene, añádelo.

- [ ] **Step 3: Escribir el script de extracción**

Crea `be_ruta/scripts/extract-growth-items.ts`:

```ts
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
    .replace(/[̀-ͯ]/g, '')
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
  for (let i = from; i < source.length; i += 1) {
    if (source[i] === '[') depth += 1;
    else if (source[i] === ']') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(source.slice(from, i + 1)) as LegacyArea[];
      }
    }
  }
  throw new Error('El bloque de áreas no cierra');
}

function extract(source: string): SeedItem[] {
  const pattern =
    /"unit":\s*"(\w+)"[^{]*?"mode":\s*"\w+",\s*"areas":\s*\[/g;
  const seen = new Set<Branch>();
  const items: SeedItem[] = [];

  for (const match of source.matchAll(pattern)) {
    const branch = asBranch(match[1]);
    if (seen.has(branch)) continue;
    seen.add(branch);

    for (const area of readAreas(source, match.index + match[0].length - 1)) {
      const growthArea = asGrowthArea(area.area);
      if (!growthAreasOf(branch).includes(growthArea)) {
        throw new Error(`${growthArea} no corresponde a la rama ${branch}`);
      }
      area.items.forEach((text, index) => {
        items.push({ branch, growthArea, order: index + 1, text: text.trim() });
      });
    }
  }

  if (seen.size !== BRANCHES.length) {
    throw new Error(`Faltan ramas: se extrajeron ${seen.size} de ${BRANCHES.length}`);
  }
  return items;
}

const items = extract(readFileSync(LEGACY, 'utf8'));
writeFileSync(OUTPUT, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
console.log(`✔ ${items.length} items escritos en ${OUTPUT}`);
```

El legado repite cada bloque de rama tres veces en el HTML; `seen` se queda con la primera aparición de cada una.

- [ ] **Step 4: Registrar el script y correrlo**

En `be_ruta/package.json`, junto a los demás scripts:

```json
    "growth-items:extract": "ts-node -P tsconfig.json scripts/extract-growth-items.ts",
```

Run:
```bash
cd be_ruta && mkdir -p src/seeds/data && pnpm growth-items:extract
```
Expected: `✔ 93 items escritos en .../growth-items.json`.

Si el número no es 93, para y revisa: el catálogo cambió respecto a lo que verificó la spec.

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd be_ruta && pnpm test -- growth-items.json`
Expected: PASS, los 5 tests.

- [ ] **Step 6: Revisar el JSON a ojo**

Run: `head -20 be_ruta/src/seeds/data/growth-items.json`
Expected: entradas con `branch`, `growthArea`, `order` y `text`. Confirma que hay `"growthArea": "socioafectividad"` solo con `"branch": "familia"`.

- [ ] **Step 7: Commit**

```bash
cd be_ruta
git add scripts/extract-growth-items.ts src/seeds/data/ package.json
git commit -m "feat(growth-items): extrae el catálogo del marco educativo legado"
```

---

### Task 5: Semilla idempotente

Puebla la colección sin pisar nada de lo que edite un administrador.

**Files:**
- Create: `be_ruta/src/seeds/growth-items-operations.ts`
- Create: `be_ruta/src/seeds/growth-items-operations.spec.ts`
- Create: `be_ruta/src/seeds/seed-growth-items.ts`
- Modify: `be_ruta/package.json`

**Interfaces:**
- Consumes: `growth-items.json` (Task 4), `GrowthItem`/`GrowthItemDocument` (Task 3).
- Produces: `buildSeedOperations(catalog: GrowthItemSeed[]): SeedOperation[]` y el comando `pnpm seed:growth-items`.

- [ ] **Step 1: Escribir el test de las operaciones**

Crea `be_ruta/src/seeds/growth-items-operations.spec.ts`:

```ts
import { buildSeedOperations } from './growth-items-operations';

const CATALOG = [
  { branch: 'tropa', growthArea: 'afectividad', order: 1, text: 'Uno' },
];

describe('buildSeedOperations', () => {
  it('filtra por la clave única de la colección', () => {
    const [operation] = buildSeedOperations(CATALOG);

    expect(operation.updateOne.filter).toEqual({
      branch: 'tropa',
      growthArea: 'afectividad',
      order: 1,
    });
  });

  it('inserta pero nunca actualiza lo que ya existe', () => {
    const [operation] = buildSeedOperations(CATALOG);

    expect(operation.updateOne.upsert).toBe(true);
    expect(operation.updateOne.update).toEqual({
      $setOnInsert: { text: 'Uno', isActive: true },
    });
    expect(operation.updateOne.update).not.toHaveProperty('$set');
  });

  it('produce una operación por item', () => {
    expect(buildSeedOperations(CATALOG)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd be_ruta && pnpm test -- growth-items-operations`
Expected: FAIL, no existe el módulo.

- [ ] **Step 3: Implementar las operaciones**

Crea `be_ruta/src/seeds/growth-items-operations.ts`:

```ts
import { type Branch, type GrowthArea } from '../domain';

export interface GrowthItemSeed {
  branch: string;
  growthArea: string;
  order: number;
  text: string;
}

export interface SeedOperation {
  updateOne: {
    filter: { branch: Branch; growthArea: GrowthArea; order: number };
    update: { $setOnInsert: { text: string; isActive: boolean } };
    upsert: true;
  };
}

/**
 * `$setOnInsert` y nunca `$set`: la semilla puebla, no reconcilia. Un item ya
 * existente conserva el texto y el estado que le haya dado un administrador.
 */
export function buildSeedOperations(
  catalog: GrowthItemSeed[],
): SeedOperation[] {
  return catalog.map((item) => ({
    updateOne: {
      filter: {
        branch: item.branch as Branch,
        growthArea: item.growthArea as GrowthArea,
        order: item.order,
      },
      update: { $setOnInsert: { text: item.text, isActive: true } },
      upsert: true,
    },
  }));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd be_ruta && pnpm test -- growth-items-operations`
Expected: PASS.

- [ ] **Step 5: Escribir el seed ejecutable**

Crea `be_ruta/src/seeds/seed-growth-items.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, type AnyBulkWriteOperation } from 'mongoose';
import { AppModule } from '../app.module';
import {
  GrowthItem,
  GrowthItemDocument,
} from '../growth-items/schemas/growth-item.schema';
import catalog from './data/growth-items.json';
import { buildSeedOperations } from './growth-items-operations';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const model = app.get<Model<GrowthItemDocument>>(
      getModelToken(GrowthItem.name),
      { strict: false },
    );

    await model.syncIndexes();
    const result = await model.bulkWrite(
      buildSeedOperations(catalog) as AnyBulkWriteOperation<GrowthItem>[],
    );
    const total = await model.countDocuments().exec();

    console.log(
      `✔ Semilla lista — ${result.upsertedCount} nuevas, ${catalog.length - result.upsertedCount} ya existían, ${total} en total.`,
    );
  } finally {
    await app.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('✖ Semilla de dimensiones falló:', error);
    process.exit(1);
  });
```

`syncIndexes()` crea el índice único antes del primer `bulkWrite`: sin él, una base ya poblada a mano podría tener duplicados que el upsert no detectaría.

- [ ] **Step 6: Registrar el comando**

En `be_ruta/package.json`, junto a los demás seeds:

```json
    "seed:growth-items": "nest build && node dist/seeds/seed-growth-items.js",
```

- [ ] **Step 7: Verificar compilación y suite**

Run: `cd be_ruta && pnpm exec tsc --noEmit && pnpm lint:check && pnpm test`
Expected: todo verde.

- [ ] **Step 8: Correr la semilla dos veces contra la base real**

Run:
```bash
cd be_ruta && pnpm seed:growth-items && pnpm seed:growth-items
```
Expected: la primera corrida reporta 93 nuevas y 93 en total; la segunda reporta **0 nuevas y 93 en total**. Si la segunda inserta algo, el índice único no se aplicó: revisa `syncIndexes`.

- [ ] **Step 9: Commit**

```bash
cd be_ruta
git add src/seeds/ package.json
git commit -m "feat(growth-items): siembra el catálogo sin pisar ediciones"
```

---

### Task 6: Cliente, tipos y reglas de rótulo en el frontend

La capa que habla con el backend y la lógica pura que el diálogo necesita.

**Files:**
- Modify: `fe_ruta/lib/domain/routes.ts`
- Modify: `fe_ruta/lib/domain/endpoints.ts`
- Create: `fe_ruta/lib/growth-items/types.ts`
- Create: `fe_ruta/lib/growth-items/labels.ts`
- Create: `fe_ruta/lib/growth-items/labels.test.ts`
- Modify: `fe_ruta/lib/backend/client.ts`
- Modify: `fe_ruta/lib/i18n/catalogo.ts`

**Interfaces:**
- Consumes: `GROWTH_AREAS`, `growthAreasOf`, `type GrowthArea`, `type Branch` de `@/lib/domain` (Task 1). Endpoints `/growth-items` (Task 3).
- Produces:
  - `ROUTES.ADMIN_DIMENSIONES` = `"/admin/dimensiones"`.
  - `ENDPOINTS.GROWTH_ITEMS.LIST` y `.detail(id)`.
  - `interface GrowthItem { id, branch, growthArea, text, order, isActive }`.
  - `resolveGrowthArea(branch, current): GrowthArea`.
  - `textLabelKeyFor(branch): ClaveMensaje`.
  - `backend.listGrowthItems | createGrowthItem | updateGrowthItem | deleteGrowthItem`.
  - Claves `K.GROWTH_ITEMS.*` del catálogo.

- [ ] **Step 1: Escribir el test de los rótulos**

Crea `fe_ruta/lib/growth-items/labels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { K } from "@/lib/i18n/mensajes";
import { resolveGrowthArea, textLabelKeyFor } from "./labels";

describe("textLabelKeyFor", () => {
  it("llama Dimensión a lo de Familia", () => {
    expect(textLabelKeyFor("familia")).toBe(K.GROWTH_ITEMS.FIELD_TEXT_FAMILIA);
  });

  it("llama Competencia a lo de las demás ramas", () => {
    expect(textLabelKeyFor("tropa")).toBe(K.GROWTH_ITEMS.FIELD_TEXT);
    expect(textLabelKeyFor("clan")).toBe(K.GROWTH_ITEMS.FIELD_TEXT);
  });
});

describe("resolveGrowthArea", () => {
  it("conserva el área cuando la rama la admite", () => {
    expect(resolveGrowthArea("tropa", "afectividad")).toBe("afectividad");
  });

  it("cae a la primera área válida cuando la rama no la admite", () => {
    expect(resolveGrowthArea("familia", "afectividad")).toBe("corporalidad");
  });

  it("resuelve socioafectividad solo en Familia", () => {
    expect(resolveGrowthArea("familia", "socioafectividad")).toBe(
      "socioafectividad",
    );
    expect(resolveGrowthArea("tropa", "socioafectividad")).toBe("corporalidad");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd fe_ruta && pnpm test -- labels`
Expected: FAIL, no existe el módulo ni las claves i18n.

- [ ] **Step 3: Añadir las claves al catálogo**

En `fe_ruta/lib/i18n/catalogo.ts`, inserta el dominio en orden alfabético (después de `GROWTH_AREA`, que añadió la Task 1):

```ts
  GROWTH_ITEMS: {
    DEACTIVATE: "Desactivar",
    DEACTIVATE_CONFIRM:
      "Deja de aparecer al planear ciclos nuevos. Lo ya registrado no cambia.",
    EDIT: "Editar",
    EMPTY: "Todavía no hay dimensiones. Crea la primera para empezar.",
    FIELD_AREA: "Área de crecimiento",
    FIELD_BRANCH: "Rama",
    FIELD_ORDER: "Orden",
    FIELD_TEXT: "Competencia",
    FIELD_TEXT_FAMILIA: "Dimensión",
    FILTER_ALL_AREAS: "Todas las áreas",
    FILTER_ALL_BRANCHES: "Todas las ramas",
    INACTIVE_BADGE: "Desactivada",
    NEW: "Nueva dimensión",
    REACTIVATE: "Reactivar",
    SHOW_INACTIVE: "Ver desactivadas",
    SUBTITLE:
      "Catálogo del marco educativo por rama y área de crecimiento",
    TABLE_TEXT: "Dimensión / Competencia",
    TITLE: "Dimensiones",
  },
```

- [ ] **Step 4: Implementar los rótulos**

Crea `fe_ruta/lib/growth-items/labels.ts`:

```ts
import { growthAreasOf, type Branch, type GrowthArea } from "@/lib/domain";
import { K, type ClaveMensaje } from "@/lib/i18n/mensajes";

const FAMILIA: Branch = "familia";

/** En Cachorros el marco las llama Dimensiones; en el resto de ramas, Competencias. */
export function textLabelKeyFor(branch: Branch): ClaveMensaje {
  return branch === FAMILIA
    ? K.GROWTH_ITEMS.FIELD_TEXT_FAMILIA
    : K.GROWTH_ITEMS.FIELD_TEXT;
}

export function resolveGrowthArea(
  branch: Branch,
  current: GrowthArea,
): GrowthArea {
  const areas = growthAreasOf(branch);
  return areas.includes(current) ? current : areas[0];
}
```

Si el lint bloquea el literal `"familia"` por la regla `no-restricted-syntax` del vocabulario de dominio, usa `D.BRANCH.FAMILIA` importado de `@/lib/domain` en lugar de la constante local.

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd fe_ruta && pnpm test -- labels`
Expected: PASS, los 5 tests.

- [ ] **Step 6: Declarar la ruta y el endpoint**

En `fe_ruta/lib/domain/routes.ts`, dentro de `ROUTES` en orden alfabético (antes de `ADMIN_PREGUNTAS`):

```ts
  ADMIN_DIMENSIONES: "/admin/dimensiones",
```

En `fe_ruta/lib/domain/endpoints.ts`, dentro de `ENDPOINTS` en orden alfabético:

```ts
  GROWTH_ITEMS: {
    LIST: "/growth-items",
    detail: (id: string) => `/growth-items/${id}`,
  },
```

- [ ] **Step 7: Declarar el tipo**

Crea `fe_ruta/lib/growth-items/types.ts`:

```ts
import type { Branch, GrowthArea } from "@/lib/domain";

export interface GrowthItem {
  id: string;
  branch: Branch;
  growthArea: GrowthArea;
  text: string;
  order: number;
  isActive: boolean;
}
```

- [ ] **Step 8: Añadir los métodos al cliente**

En `fe_ruta/lib/backend/client.ts`, importa el tipo junto a los demás:

```ts
import type { GrowthItem } from "@/lib/growth-items/types";
```

Declara el input junto a `QuestionInput`:

```ts
interface GrowthItemInput {
  branch: string;
  growthArea: string;
  text: string;
  order: number;
}
```

Y añade los cuatro métodos después de `deleteQuestion`:

```ts
  listGrowthItems(
    token: string,
    params: {
      branch?: string;
      growthArea?: string;
      includeInactive?: boolean;
    } = {},
  ): Promise<GrowthItem[]> {
    const query = new URLSearchParams();
    if (params.branch) query.set("branch", params.branch);
    if (params.growthArea) query.set("growthArea", params.growthArea);
    if (params.includeInactive) query.set("includeInactive", "true");
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return request<MongoDocument<GrowthItem>[]>(
      `${ENDPOINTS.GROWTH_ITEMS.LIST}${suffix}`,
      { token },
    ).then((docs) => docs.map(fromMongo));
  },
  createGrowthItem(token: string, input: GrowthItemInput): Promise<GrowthItem> {
    return request<MongoDocument<GrowthItem>>(ENDPOINTS.GROWTH_ITEMS.LIST, {
      method: "POST",
      body: input,
      token,
    }).then(fromMongo);
  },
  updateGrowthItem(
    token: string,
    id: string,
    input: Partial<GrowthItemInput> & { isActive?: boolean },
  ): Promise<GrowthItem> {
    return request<MongoDocument<GrowthItem>>(
      ENDPOINTS.GROWTH_ITEMS.detail(id),
      { method: "PATCH", body: input, token },
    ).then(fromMongo);
  },
  deleteGrowthItem(token: string, id: string): Promise<void> {
    return request<void>(ENDPOINTS.GROWTH_ITEMS.detail(id), {
      method: "DELETE",
      token,
    });
  },
```

- [ ] **Step 9: Verificar**

Run: `cd fe_ruta && pnpm exec tsc --noEmit && pnpm test && pnpm i18n:check`
Expected: todo verde.

- [ ] **Step 10: Commit**

```bash
cd fe_ruta
git add lib/domain/routes.ts lib/domain/endpoints.ts lib/growth-items/ lib/backend/client.ts lib/i18n/catalogo.ts
git commit -m "feat(growth-items): cablea el cliente y las reglas de rótulo"
```

---

### Task 7: Pantalla de administración

La página, sus acciones y los dos componentes.

**Files:**
- Create: `fe_ruta/app/(privado)/admin/dimensiones/page.tsx`
- Create: `fe_ruta/app/(privado)/admin/dimensiones/actions.ts`
- Create: `fe_ruta/components/growth-items/growth-item-table.tsx`
- Create: `fe_ruta/components/growth-items/growth-item-dialog.tsx`
- Modify: `fe_ruta/ROADMAP.md`

**Interfaces:**
- Consumes: todo lo que produjo la Task 6.
- Produces: la ruta `/admin/dimensiones` operativa.

- [ ] **Step 1: Crear los server actions**

Crea `fe_ruta/app/(privado)/admin/dimensiones/actions.ts`:

```ts
"use server";

import { runAction, type ActionResult } from "@/lib/actions/run";
import { backend } from "@/lib/backend/client";
import { ROUTES } from "@/lib/domain";

const PATHS = [ROUTES.ADMIN_DIMENSIONES];

function run(
  permission: string,
  operation: (token: string) => Promise<unknown>,
): Promise<ActionResult> {
  return runAction(permission, PATHS, operation);
}

export async function createGrowthItemAction(input: {
  branch: string;
  growthArea: string;
  text: string;
  order: number;
}): Promise<ActionResult> {
  return run("growth-item:create", (token) =>
    backend.createGrowthItem(token, input),
  );
}

export async function updateGrowthItemAction(
  id: string,
  input: {
    branch?: string;
    growthArea?: string;
    text?: string;
    order?: number;
  },
): Promise<ActionResult> {
  return run("growth-item:update", (token) =>
    backend.updateGrowthItem(token, id, input),
  );
}

export async function toggleGrowthItemAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  if (isActive) {
    return run("growth-item:update", (token) =>
      backend.updateGrowthItem(token, id, { isActive: true }),
    );
  }
  return run("growth-item:delete", (token) =>
    backend.deleteGrowthItem(token, id),
  );
}
```

- [ ] **Step 2: Crear la página**

Crea `fe_ruta/app/(privado)/admin/dimensiones/page.tsx`:

```tsx
import { requirePermission, requireRoute } from "@/lib/auth";
import { backend } from "@/lib/backend/client";
import { K, t } from "@/lib/i18n/mensajes";
import { ROUTES } from "@/lib/domain";
import { readTokens } from "@/lib/session";
import { GrowthItemTable } from "@/components/growth-items/growth-item-table";

export default async function DimensionesPage() {
  await requirePermission("growth-item:read");
  await requireRoute(ROUTES.ADMIN_DIMENSIONES);

  const { accessToken } = await readTokens();
  const growthItems = accessToken
    ? await backend.listGrowthItems(accessToken, { includeInactive: true })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-jollygood text-2xl font-bold tracking-tight text-pnpj-morado sm:text-3xl">
          {t(K.GROWTH_ITEMS.TITLE)}
        </h1>
        <p className="text-muted-foreground">{t(K.GROWTH_ITEMS.SUBTITLE)}</p>
      </div>
      <GrowthItemTable growthItems={growthItems} />
    </div>
  );
}
```

- [ ] **Step 3: Crear el diálogo**

Crea `fe_ruta/components/growth-items/growth-item-dialog.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createGrowthItemAction,
  updateGrowthItemAction,
} from "@/app/(privado)/admin/dimensiones/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  BRANCHES,
  BRANCH_MESSAGE_KEY,
  GROWTH_AREA_MESSAGE_KEY,
  growthAreasOf,
  type Branch,
  type GrowthArea,
} from "@/lib/domain";
import { resolveGrowthArea, textLabelKeyFor } from "@/lib/growth-items/labels";
import type { GrowthItem } from "@/lib/growth-items/types";
import { K, t } from "@/lib/i18n/mensajes";

interface GrowthItemDialogProps {
  growthItem?: GrowthItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GrowthItemDialog({
  growthItem,
  open,
  onOpenChange,
}: GrowthItemDialogProps) {
  const router = useRouter();
  const [branch, setBranch] = useState<Branch>(
    growthItem?.branch ?? BRANCHES[0],
  );
  const [growthArea, setGrowthArea] = useState<GrowthArea>(
    growthItem?.growthArea ?? growthAreasOf(growthItem?.branch ?? BRANCHES[0])[0],
  );
  const [text, setText] = useState(growthItem?.text ?? "");
  const [order, setOrder] = useState<number | "">(growthItem?.order ?? "");
  const [pending, startTransition] = useTransition();

  const canSubmit =
    text.trim().length > 0 && order !== "" && Number.isFinite(order);

  function changeBranch(value: Branch) {
    setBranch(value);
    setGrowthArea((current) => resolveGrowthArea(value, current));
  }

  function handleSubmit() {
    if (order === "") return;
    const input = { branch, growthArea, text: text.trim(), order };

    startTransition(async () => {
      const result = growthItem
        ? await updateGrowthItemAction(growthItem.id, input)
        : await createGrowthItemAction(input);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {growthItem ? t(K.GROWTH_ITEMS.EDIT) : t(K.GROWTH_ITEMS.NEW)}
          </DialogTitle>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="growth-item-branch">
              {t(K.GROWTH_ITEMS.FIELD_BRANCH)}
            </FieldLabel>
            <NativeSelect
              id="growth-item-branch"
              value={branch}
              onChange={(event) => changeBranch(event.target.value as Branch)}
            >
              {BRANCHES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {t(BRANCH_MESSAGE_KEY[value])}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="growth-item-area">
              {t(K.GROWTH_ITEMS.FIELD_AREA)}
            </FieldLabel>
            <NativeSelect
              id="growth-item-area"
              value={growthArea}
              onChange={(event) =>
                setGrowthArea(event.target.value as GrowthArea)
              }
            >
              {growthAreasOf(branch).map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {t(GROWTH_AREA_MESSAGE_KEY[value])}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="growth-item-text">
              {t(textLabelKeyFor(branch))}
            </FieldLabel>
            <Textarea
              id="growth-item-text"
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="growth-item-order">
              {t(K.GROWTH_ITEMS.FIELD_ORDER)}
            </FieldLabel>
            <Input
              id="growth-item-order"
              type="number"
              value={order}
              onChange={(event) =>
                setOrder(
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || pending}
          >
            {growthItem ? t(K.COMMON.SAVE_CHANGES) : t(K.GROWTH_ITEMS.NEW)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Crear la tabla**

Crea `fe_ruta/components/growth-items/growth-item-table.tsx`. Es el mismo esqueleto de `components/questions/question-table.tsx` con tres cambios: el filtro de bloque pasa a ser de área y depende de la rama activa, la columna de texto usa `K.GROWTH_ITEMS.TABLE_TEXT`, y los permisos son `growth-item:*`.

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleGrowthItemAction } from "@/app/(privado)/admin/dimensiones/actions";
import {
  filaCabeceraTabla,
  filaCuerpoTabla,
  TablaAdmin,
} from "@/components/app/admin/tabla";
import { GlassCard } from "@/components/app/glass-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  BRANCHES,
  BRANCH_MESSAGE_KEY,
  GROWTH_AREAS,
  GROWTH_AREA_MESSAGE_KEY,
  growthAreasOf,
  type Branch,
  type GrowthArea,
} from "@/lib/domain";
import { Can } from "@/lib/permissions";
import { K, t } from "@/lib/i18n/mensajes";
import type { GrowthItem } from "@/lib/growth-items/types";
import { GrowthItemDialog } from "@/components/growth-items/growth-item-dialog";

interface GrowthItemTableProps {
  growthItems: GrowthItem[];
}

const ALL_BRANCHES = "all";
const ALL_AREAS = "all";

export function GrowthItemTable({ growthItems }: GrowthItemTableProps) {
  const router = useRouter();
  const [branchFilter, setBranchFilter] = useState<
    Branch | typeof ALL_BRANCHES
  >(ALL_BRANCHES);
  const [areaFilter, setAreaFilter] = useState<GrowthArea | typeof ALL_AREAS>(
    ALL_AREAS,
  );
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInstance, setDialogInstance] = useState(0);
  const [editing, setEditing] = useState<GrowthItem | undefined>();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const areaOptions =
    branchFilter === ALL_BRANCHES ? GROWTH_AREAS : growthAreasOf(branchFilter);

  const filtered = useMemo(
    () =>
      growthItems
        .filter(
          (item) => branchFilter === ALL_BRANCHES || item.branch === branchFilter,
        )
        .filter((item) => areaFilter === ALL_AREAS || item.growthArea === areaFilter)
        .filter((item) => showInactive || item.isActive)
        .sort((a, b) => a.order - b.order),
    [growthItems, branchFilter, areaFilter, showInactive],
  );

  function changeBranchFilter(value: Branch | typeof ALL_BRANCHES) {
    setBranchFilter(value);
    setAreaFilter((current) => {
      if (current === ALL_AREAS || value === ALL_BRANCHES) return current;
      return growthAreasOf(value).includes(current) ? current : ALL_AREAS;
    });
  }

  function openCreate() {
    setEditing(undefined);
    setDialogInstance((instance) => instance + 1);
    setDialogOpen(true);
  }

  function openEdit(item: GrowthItem) {
    setEditing(item);
    setDialogInstance((instance) => instance + 1);
    setDialogOpen(true);
  }

  function handleToggle(item: GrowthItem) {
    setPendingId(item.id);
    startTransition(async () => {
      const result = await toggleGrowthItemAction(item.id, !item.isActive);
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="filter-branch">
            {t(K.GROWTH_ITEMS.FIELD_BRANCH)}
          </Label>
          <NativeSelect
            id="filter-branch"
            value={branchFilter}
            onChange={(event) =>
              changeBranchFilter(
                event.target.value as Branch | typeof ALL_BRANCHES,
              )
            }
          >
            <NativeSelectOption value={ALL_BRANCHES}>
              {t(K.GROWTH_ITEMS.FILTER_ALL_BRANCHES)}
            </NativeSelectOption>
            {BRANCHES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {t(BRANCH_MESSAGE_KEY[value])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="filter-area">{t(K.GROWTH_ITEMS.FIELD_AREA)}</Label>
          <NativeSelect
            id="filter-area"
            value={areaFilter}
            onChange={(event) =>
              setAreaFilter(event.target.value as GrowthArea | typeof ALL_AREAS)
            }
          >
            <NativeSelectOption value={ALL_AREAS}>
              {t(K.GROWTH_ITEMS.FILTER_ALL_AREAS)}
            </NativeSelectOption>
            {areaOptions.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {t(GROWTH_AREA_MESSAGE_KEY[value])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <Checkbox
            id="filter-show-inactive"
            checked={showInactive}
            onCheckedChange={(checked) => setShowInactive(checked)}
          />
          <Label htmlFor="filter-show-inactive" className="font-normal">
            {t(K.GROWTH_ITEMS.SHOW_INACTIVE)}
          </Label>
        </div>

        <div className="flex-1" />

        <Can permission="growth-item:create">
          <Button type="button" onClick={openCreate}>
            {t(K.GROWTH_ITEMS.NEW)}
          </Button>
        </Can>
      </div>

      {filtered.length === 0 ? (
        <GlassCard>
          <CardContent className="pt-6">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t(K.GROWTH_ITEMS.EMPTY)}</EmptyTitle>
              </EmptyHeader>
              <Can permission="growth-item:create">
                <EmptyContent>
                  <Button type="button" onClick={openCreate}>
                    {t(K.GROWTH_ITEMS.NEW)}
                  </Button>
                </EmptyContent>
              </Can>
            </Empty>
          </CardContent>
        </GlassCard>
      ) : (
        <TablaAdmin>
          <thead>
            <tr className={filaCabeceraTabla}>
              <th scope="col" className="px-3 py-2 font-medium">
                {t(K.GROWTH_ITEMS.FIELD_ORDER)}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t(K.GROWTH_ITEMS.FIELD_BRANCH)}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t(K.GROWTH_ITEMS.FIELD_AREA)}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t(K.GROWTH_ITEMS.TABLE_TEXT)}
              </th>
              <th scope="col" className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className={filaCuerpoTabla}>
                <td className="px-3 py-2">{item.order}</td>
                <td className="px-3 py-2">
                  {t(BRANCH_MESSAGE_KEY[item.branch])}
                </td>
                <td className="px-3 py-2">
                  {t(GROWTH_AREA_MESSAGE_KEY[item.growthArea])}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {item.text}
                    {!item.isActive && (
                      <Badge variant="destructive">
                        {t(K.GROWTH_ITEMS.INACTIVE_BADGE)}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <Can permission="growth-item:update">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(item)}
                      >
                        {t(K.GROWTH_ITEMS.EDIT)}
                      </Button>
                    </Can>

                    {item.isActive ? (
                      <Can permission="growth-item:delete">
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={pendingId === item.id}
                              />
                            }
                          >
                            {t(K.GROWTH_ITEMS.DEACTIVATE)}
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t(K.GROWTH_ITEMS.DEACTIVATE)}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t(K.GROWTH_ITEMS.DEACTIVATE_CONFIRM)}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                {t(K.COMMON.CANCEL)}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() => handleToggle(item)}
                              >
                                {t(K.GROWTH_ITEMS.DEACTIVATE)}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </Can>
                    ) : (
                      <Can permission="growth-item:update">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pendingId === item.id}
                          onClick={() => handleToggle(item)}
                        >
                          {t(K.GROWTH_ITEMS.REACTIVATE)}
                        </Button>
                      </Can>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TablaAdmin>
      )}

      <GrowthItemDialog
        key={dialogInstance}
        growthItem={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verificar compilación y tests**

Run: `cd fe_ruta && pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm i18n:check`
Expected: todo verde.

- [ ] **Step 6: Verificar en el navegador**

Levanta `be_ruta` (puerto 3000) y `fe_ruta` (3001). Entra a `/admin/dimensiones` con un usuario que tenga `growth-item:read`.

Comprueba a mano:
1. La tabla lista los 93 items sembrados.
2. Al filtrar por Familia, el select de área ofrece 5 opciones e incluye "Socioafectividad".
3. Al filtrar por Tropa, ofrece 6 y NO incluye "Socioafectividad".
4. En "Nueva dimensión", con Familia seleccionada el rótulo del texto dice **Dimensión**; al cambiar a Tropa dice **Competencia** y el área salta a una válida.
5. Guardar un item con un orden ya usado en esa rama y área muestra el mensaje de conflicto, no un error genérico.
6. Desactivar muestra la insignia y "Reactivar".

Usa la skill `verificar-visual` (Claude in Chrome) para la captura y la consola. El preview MCP no funciona con Next 16 en este repo.

- [ ] **Step 7: Marcar el ROADMAP**

En `fe_ruta/ROADMAP.md`, marca `[x]` lo que este cambio cierra. Si no hay una casilla para las dimensiones, añade la línea en la sección de administración.

- [ ] **Step 8: Commit**

```bash
cd fe_ruta
git add "app/(privado)/admin/dimensiones/" components/growth-items/ ROADMAP.md
git commit -m "feat(growth-items): añade la sección de dimensiones en administración"
```

---

### Task 8: Verificación de cierre

Ningún "listo" sin evidencia.

**Files:**
- Ninguno nuevo. Corrección de lo que aparezca.

- [ ] **Step 1: Guards del backend**

Run:
```bash
cd be_ruta && pnpm domain:check && pnpm exec tsc --noEmit && pnpm lint:check && pnpm test
```
Expected: todo verde. Pega la salida en el reporte.

- [ ] **Step 2: Guards del frontend**

Run:
```bash
cd fe_ruta && pnpm domain:check && pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm i18n:check && pnpm env:check
```
Expected: todo verde.

- [ ] **Step 3: Build del frontend**

Run: `cd fe_ruta && pnpm build`
Expected: compila sin errores. `/admin/dimensiones` aparece en el listado de rutas.

- [ ] **Step 4: Comprobar el comodín de permisos de punta a punta**

Crea un rol con `growth-item:*` desde `/admin/roles` y confirma que se guarda. Antes del fix del regex, el backend lo rechazaba con error de validación.

- [ ] **Step 5: Confirmar la idempotencia una vez más**

Run: `cd be_ruta && pnpm seed:growth-items`
Expected: 0 nuevas, 93 en total.

- [ ] **Step 6: Revisar los diff completos**

Run:
```bash
git -C be_ruta log --oneline dimension
git -C fe_ruta log --oneline dimension
git -C be_ruta diff master..dimension --stat
git -C fe_ruta diff master..dimension --stat
```

Barre los comentarios sobrantes con la skill `sin-comentarios` antes de dar el trabajo por cerrado.
