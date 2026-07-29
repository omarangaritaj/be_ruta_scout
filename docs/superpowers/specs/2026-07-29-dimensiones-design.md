# Dimensiones: catálogo administrable del marco educativo

Fecha: 2026-07-29
Repos afectados: `be_ruta`, `fe_ruta`

## Objetivo

Crear en administración la sección **Dimensiones**: un catálogo por rama y área de
crecimiento, con el mismo comportamiento que "Preguntas de diagnóstico" (CRUD,
soft-delete, permisos propios, filtros). Sembrarlo con los 93 items del marco
educativo que hoy viven en el entorno legado v0.6.2.

## Contexto: qué existe hoy

- `src/questions/` es el molde: schema Mongoose, service, controller con
  `RequirePermissions`, DTO zod y soft-delete por `isActive`. La sección espejo en
  el frontend es `app/(privado)/admin/preguntas/` + `components/questions/`.
- El vocabulario que cruza la frontera entre repos se edita SOLO en
  `domain-manifest.json`, idéntico byte a byte en los dos repos y verificado por
  SHA-256 en `scripts/domain-check.ts`. `src/domain/` y `lib/domain/` son
  generados por `pnpm domain:gen`.
- Los dos `scripts/domain-codegen.ts` **no** son idénticos: cada repo genera a su
  propia carpeta y enumera cada clave del manifiesto de forma explícita. Un bloque
  nuevo obliga a editar los dos.
- **No existe** el concepto de área de crecimiento en el código. Solo aparece como
  enum `area_crecimiento` en `modelo-datos-programa.dbml`, que es el modelo del
  futuro esquema de Programa, no la base viva.
- El enfoque del ciclo guarda las competencias como texto libre
  (`cycle.schema.ts` → `competencies: string[]`, editado en
  `components/cycles/focus-form.tsx`).

## Hallazgos que fijaron el diseño

**Dimensión y competencia son el mismo concepto con distinto nombre según la rama.**
No hay jerarquía entre ellos. Evidencia en dos fuentes independientes:

- `modelo-datos-programa.dbml:456` — la tabla `competencias` tiene una columna
  `dimension text` con la nota literal *"en Cachorros se llaman Dimensiones"*.
- `fe_ruta/docs/referencia/entorno-programa-v0.6.2.html` — cada rama declara un
  `mode`, y el select se rotula con
  `b.mode === 'dimensiones' ? 'Dimensión' : 'Competencia'`. Los datos son
  `areas: [{ area, items: [...] }]`: rama → área → lista de items del mismo nivel.

**El catálogo legado es extraíble y cuadra con el dbml.** Conteo verificado:

| Rama | Modo | Áreas | Items |
|---|---|---|---|
| Familia | dimensiones | 5 | 5 |
| Manada | competencias | 6 | 22 |
| Tropa | competencias | 6 | 22 |
| Comunidad | competencias | 6 | 22 |
| Clan | competencias | 6 | 22 |

Los 22 por rama coinciden con `modelo-datos-programa.dbml:461`: *"22 competencias
por rama en secuencia común"*. Total: **93 items**.

**Familia no usa las 6 áreas clásicas.** Usa 5, y una de ellas es
**Socioafectividad** — Afectividad y Sociabilidad fusionadas. No está en el enum
del dbml ni en ninguna lista previa.

**La granularidad también difiere.** Familia trae un párrafo largo por área
("Construye vínculos positivos con sus compañeros y adultos mediante interacciones
afectuosas..."); las demás ramas traen frases cortas ("Actividad física y hábitos
de movimiento consciente."). Mismo nivel conceptual, distinta extensión: el campo
de texto tiene que soportar ambas.

**`isValidPermission` rechaza los recursos con guion.** En
`src/authz/permissions.catalog.ts:115` el comodín de recurso se valida con
`/^([a-z]+):\*$/`, que no acepta `-`. Comprobado: `growth-item:*` → `false`,
`question:*` → `true`. Como ese predicado alimenta el `.refine()` de
`create-role.dto.ts` y `update-role.dto.ts`, un rol no podría recibir
`growth-item:*`. El frontend no sufre esto: `lib/permisos.ts` resuelve por
`split(":")`, no por regex.

## Decisiones

| Decisión | Elegido |
|---|---|
| Forma de la entidad | Una sola, plana: `{ branch, growthArea, text, order, isActive }` |
| Nombre de "dimensión" vs "competencia" | Rótulo de UI derivado de la rama, no dos entidades |
| Socioafectividad | Séptimo valor del enum, válido solo en Familia |
| Dónde vive el mapa rama → áreas | Dentro de cada entrada de `branches` en el manifiesto |
| Identificador técnico | `growth-item` (permiso, módulo, endpoint) |
| Rótulo de la sección | "Dimensiones" |
| Estructura | Módulo espejo de `questions`, sin abstracción compartida |
| Validación rama↔área | En el service (función pura), no en el DTO |
| Idempotencia del seed | Índice único `(branch, growthArea, order)` + upsert |
| Origen de la semilla | JSON commiteado, extraído una vez del HTML legado |

### Por qué el rótulo y no dos entidades

Modelar "Dimensión" como contenedor de "Competencia" inventaría una jerarquía que
el marco educativo del PNPJ no tiene. Las dos fuentes citadas arriba muestran el
mismo nivel con dos nombres. Una entidad, un rótulo que depende de la rama.

### Por qué `growth-item` y no `dimension` ni `competency`

De los 93 registros, 88 son competencias y 5 son dimensiones. `dimension` nombraría
la excepción; `competency` chocaría con las 5 de Familia. `growth-item` no toma
partido. El costo aceptado: es vocabulario que no existe en los manuales del PNPJ,
así que **solo vive en el código** — todo lo que ve el usuario dice "Dimensiones",
"Dimensión" o "Competencia".

### Por qué el mapa rama → áreas va dentro de `branches`

La rama es la dueña natural del dato, y el codegen ya deriva mapas desde `branches`
(`aliasMap`, `ageRangeMap`). Declararlo ahí hace imposible registrar una rama sin
áreas: no hay dónde olvidarlas.

### Por qué la validación rama↔área va en el service

En un `PATCH` parcial se puede mandar solo `growthArea`; validarla exige la
`branch` ya persistida, que el DTO no conoce. El DTO valida formato, el service
valida dominio con una función pura y testeable.

## Modelo de dominio

### Bloque nuevo en `domain-manifest.json`

```json
"growthAreas": [
  { "name": "CORPORALIDAD",     "value": "corporalidad" },
  { "name": "CREATIVIDAD",      "value": "creatividad" },
  { "name": "CARACTER",         "value": "caracter" },
  { "name": "AFECTIVIDAD",      "value": "afectividad" },
  { "name": "SOCIABILIDAD",     "value": "sociabilidad" },
  { "name": "ESPIRITUALIDAD",   "value": "espiritualidad" },
  { "name": "SOCIOAFECTIVIDAD", "value": "socioafectividad" }
]
```

### Campo nuevo en cada entrada de `branches`

| Rama | `growthAreas` |
|---|---|
| familia | corporalidad, creatividad, caracter, socioafectividad, espiritualidad |
| manada | corporalidad, creatividad, caracter, afectividad, sociabilidad, espiritualidad |
| tropa | idem manada |
| comunidad | idem manada |
| clan | idem manada |

### Permisos nuevos

```json
{ "key": "growth-item:read",   "side": "both" },
{ "key": "growth-item:create", "side": "both" },
{ "key": "growth-item:update", "side": "both" },
{ "key": "growth-item:delete", "side": "both" }
```

Con sus descripciones en español en `src/authz/permissions.catalog.ts`.

### Ruta nueva

```json
{ "path": "/admin/dimensiones", "label": "Dimensiones", "section": "Administración" }
```

### Cambios en los dos `scripts/domain-codegen.ts`

- `DomainManifest`: campo `growthAreas: NamedValue[]`; `BranchEntry` gana
  `growthAreas: string[]`.
- `readManifest`: `assertUnique(growthAreas)` y un `assertBranchGrowthAreas` nuevo
  que falla si una rama lista un área inexistente, la repite o queda sin ninguna.
  La validación vive en el manifiesto porque es la única fuente de verdad, igual
  que `assertAgeRanges`.
- Archivo generado `domain/growth-areas.ts`:

```ts
GROWTH_AREAS / GrowthArea
GROWTH_AREA_MESSAGE_KEY            // 'GROWTH_AREA.CORPORALIDAD', ...
BRANCH_GROWTH_AREAS                // Record<Branch, readonly GrowthArea[]>
growthAreasOf(branch): readonly GrowthArea[]
```

- `dictionary.ts`: grupo `GROWTH_AREA` en `D`.
- `index.ts`: `export * from './growth-areas'`.
- `.domain-vocabulary.json`: los 7 valores entran al vocabulario, con lo que la
  regla `no-restricted-syntax` bloquea escribir `'corporalidad'` suelto en el
  código. Es el efecto buscado.

### Corrección de `isValidPermission`

```ts
const recursoWildcard = /^([a-z][a-z-]*):\*$/.exec(value);
```

## Backend

### Estructura

```
src/growth-items/
  schemas/growth-item.schema.ts
  dto/growth-item-base.schema.ts
  dto/create-growth-item.dto.ts
  dto/update-growth-item.dto.ts
  dto/list-growth-items.dto.ts
  growth-items.service.ts
  growth-items.service.spec.ts
  growth-items.controller.ts
  growth-items.module.ts
```

### Colección `growth_items`

```ts
branch: Branch          // enum BRANCHES, required
growthArea: GrowthArea  // enum GROWTH_AREAS, required
text: string            // required, trim
order: number           // required, int
isActive: boolean       // default true
```

Índice **único** `{ branch: 1, growthArea: 1, order: 1 }`. Es lo único que se
aparta del molde de `questions`, y da dos cosas: idempotencia del seed por upsert
sobre esa clave, y orden no ambiguo dentro de cada área.

### Reglas

- `assertAreaBelongsToBranch(branch, growthArea)` — pura, con su propio spec.
  El service la aplica en `create` y en `update`, en este último resolviendo los
  campos ausentes contra el documento persistido.
- `remove` es soft-delete: `isActive: false`.
- `findAll(branch?, growthArea?, includeInactive)` ordena por
  `{ branch, growthArea, order }`.

### Errores

| Caso | Excepción | Clave i18n |
|---|---|---|
| Área que no aplica a la rama | `AppBadRequestException` | `GROWTH_ITEMS.AREA_NOT_IN_BRANCH` |
| Orden repetido en (rama, área) | `AppConflictException` (Mongo 11000) | `GROWTH_ITEMS.ORDER_TAKEN` |
| Id inexistente | `AppNotFoundException` | `GROWTH_ITEMS.NOT_FOUND` |

### Endpoints

`@UseGuards(JwtAuthGuard, PermissionsGuard)` sobre `@Controller('growth-items')`:

| Método | Permiso | Notas |
|---|---|---|
| `GET /growth-items` | `growth-item:read` | query `branch`, `growthArea`, `includeInactive` |
| `POST /growth-items` | `growth-item:create` | |
| `PATCH /growth-items/:id` | `growth-item:update` | `ParseObjectIdPipe` |
| `DELETE /growth-items/:id` | `growth-item:delete` | 204, soft-delete |

## Frontend

### Archivos

```
lib/domain/routes.ts                          + ADMIN_DIMENSIONES
lib/domain/endpoints.ts                       + GROWTH_ITEMS { LIST, detail(id) }
lib/backend/client.ts                         + list/create/update/deleteGrowthItem
lib/growth-items/types.ts                     + GrowthItem
lib/growth-items/labels.ts                    + labels.test.ts
app/(privado)/admin/dimensiones/page.tsx
app/(privado)/admin/dimensiones/actions.ts
components/growth-items/growth-item-table.tsx
components/growth-items/growth-item-dialog.tsx
lib/i18n/catalogo.ts                          + K.GROWTH_ITEMS.*, K.GROWTH_AREA.*
```

### Módulo puro `lib/growth-items/labels.ts`

```ts
resolveGrowthArea(branch, current): GrowthArea  // la actual si aplica, si no la primera válida
textLabelKeyFor(branch): ClaveMensaje           // familia -> "Dimensión" | resto -> "Competencia"
```

Nace con su `labels.test.ts` (vitest), según la convención del repo: todo módulo
puro nuevo trae el suyo. Mantener esta lógica fuera de los componentes es lo que
permite probarla sin montar React.

### Tres diferencias respecto a `/admin/preguntas`

1. **El select de área depende de la rama.** Al cambiar de rama, el diálogo
   resuelve el área con `resolveGrowthArea`.
2. **El campo de texto es `Textarea`, no `Input`.** Los items de Familia son
   párrafos completos.
3. **El encabezado de la columna es neutro: "Dimensión / Competencia".** La tabla
   mezcla ramas, así que no puede comprometerse con un nombre; el rótulo del
   formulario sí cambia, porque ahí la rama ya está elegida. El legado usa
   exactamente ese encabezado en su exportación (`['item','Dimensión/Competencia']`).

### Autorización

`page.tsx` abre con `requirePermission("growth-item:read")` y
`requireRoute(ROUTES.ADMIN_DIMENSIONES)`. Cada server action llama a `runAction`
con su permiso. `<Can permission="growth-item:create">` y compañía solo ocultan
controles: la autorización real está en el server action y en el controller.

### Filtros de la tabla

Rama, área (filtrada por la rama activa) y "ver desactivadas". Con 93 registros el
filtro por rama es necesidad, no adorno.

## Datos: la semilla

```
scripts/extract-growth-items.ts    // se corre una vez, no en runtime
src/seeds/data/growth-items.json   // 93 registros, se commitea
src/seeds/seed-growth-items.ts
package.json                       // "seed:growth-items"
```

La extracción se hace una vez y su resultado se commitea. Un seed que scrapea un
documento de referencia en cada corrida se rompe el día que alguien toque ese
archivo; un JSON versionado es auditable, revisable en el PR y diffeable.

- **Mapeo de áreas**: minúsculas sin tildes. `Carácter` → `caracter`,
  `Socioafectividad` → `socioafectividad`.
- **`order`**: 1..n dentro de cada `(rama, área)`, respetando la secuencia legada.
- **Idempotente y no destructivo**: upsert por `(branch, growthArea, order)` con
  `$setOnInsert`, nunca `$set`. El seed **puebla, no reconcilia**: si el registro
  ya existe no se toca ni su `text` ni su `isActive`. Correrlo diez veces deja los
  mismos 93 registros y respeta cualquier edición hecha desde la UI, que es la
  fuente de verdad una vez sembrado el catálogo.
- **Nunca borra.** Un item que desaparezca del JSON no se elimina de la base; si
  hay que retirarlo se desactiva desde la UI.

## Verificación

| Dónde | Qué |
|---|---|
| be (jest) | `growth-items.service.spec`: CRUD, soft-delete, filtros |
| be (jest) | regla rama↔área (función pura) |
| be (jest) | conflicto de orden duplicado |
| be (jest) | idempotencia del seed: dos corridas dejan 93 registros |
| be (jest) | `domain-codegen.spec`: el guard rechaza área inexistente, repetida y rama vacía |
| be (jest) | `permissions.catalog.spec`: `growth-item:*` es válido — este test falla antes del fix del regex |
| fe (vitest) | `labels.test.ts`: rótulo por rama y resolución del área al cambiar de rama |
| ambos | `domain:check` (paridad SHA-256 del manifiesto), `i18n:check`, `tsc --noEmit`, `lint` |
| visual | skill `verificar-visual` con Claude in Chrome; el preview MCP no funciona con Next 16 en este repo |

## Fuera de alcance

- **Conectar el catálogo al enfoque del ciclo.** `focus.competencies` sigue siendo
  texto libre. El legado indica que las dimensiones y competencias del foco
  alimentan la planeación de Oportunidades de Aprendizaje, pero cablearlo toca un
  módulo ya en uso y exige decidir qué pasa con los ciclos guardados. Va en un
  cambio aparte.
- Cualquier cambio en `modelo-datos-programa.dbml`. El enum `area_crecimiento` de
  ese archivo tiene 6 valores y no incluye `socioafectividad`; alinearlo pertenece
  a la migración del esquema de Programa, no a este cambio.
- Sincronización por PowerSync. El catálogo se sirve por HTTP como el resto de
  administración.

## Riesgos

- **El catálogo de Familia puede estar incompleto.** El legado trae 1 item por área
  (5 en total) contra 22 por rama en las demás. Puede que el material oficial de
  Cachorros tenga más y el legado esté resumido. El seed refleja el legado, que es
  la única fuente disponible; el resto se completa desde la UI o con un segundo
  seed cuando aparezca el anexo. No se inventa contenido educativo.
- **`growth-item` es el primer recurso con guion.** El fix del regex lo cubre, pero
  cualquier otro lugar que asuma `[a-z]+` para un recurso quedaría igual de roto.
  El spec de `permissions.catalog` deja el caso cubierto.
- **El manifiesto se edita en dos repos.** `domain:check` compara los SHA-256 y
  rompe CI si divergen; los `domain-codegen.ts`, en cambio, no se comparan entre
  sí y hay que mantenerlos a mano.
