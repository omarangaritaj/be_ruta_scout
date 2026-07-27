# Diccionario de dominio para fe_ruta y be_ruta

> Diseño validado el 2026-07-27. Elimina los literales de dominio sueltos de
> ambos repos y los centraliza en un manifiesto único, espejado y verificado.

## Problema

El vocabulario del dominio (ramas, estados de acceso, niveles, permisos) viaja
por el código como literales sueltos. No es que falten constantes: existen y
casi nadie las usa.

Constantes que ya existen y se ignoran:

| Repo | Archivo | Define |
|---|---|---|
| be_ruta | `src/users/schemas/user.schema.ts` | `ESTADOS_ACCESO`, `NIVELES_ACCESO`, `TIPOS_PERSONA` |
| be_ruta | `src/users/schemas/cargo.subschema.ts` | `NIVELES_CARGO` |
| be_ruta | `src/catalogo-cargos/ramas.ts` | `RAMAS`, `ETIQUETA_RAMA`, alias de SiScout |
| be_ruta | `src/authz/permissions.catalog.ts` | `PERMISSIONS` (21 permisos) |
| fe_ruta | `lib/units/types.ts` | `Branch`, `BRANCH_LABELS` |
| fe_ruta | `lib/scouts.ts` | `Rama`, `ETIQUETA_RAMA` |

Conteo de literales sueltos (excluyendo tests), medido el 2026-07-27:

| Literal | Ocurrencias |
|---|---|
| `aprobado` | 54 |
| `pendiente` | 33 |
| `suspendido` | 26 |
| `rechazado` | 15 |
| `sin_solicitud` | 8 |
| `grupo` | 98 |
| `region` | 68 |
| `nacion` | 53 |
| `super_admin` | 26 |
| ramas (`manada`, `tropa`, `clan`, ...) | ~40 en 29 archivos |

### El defecto de fondo: tres vocabularios para las ramas

```ts
// fe_ruta/lib/units/types.ts
export type Branch = "familia" | "manada" | "tropa" | "comunidad" | "clan";

// fe_ruta/lib/scouts.ts
export type Rama = "cachorros" | "lobatos" | "scouts" | "nomadas" | "rovers";

// fe_ruta/components/playground/form-demo.tsx:19
const RAMAS = { /* tercera definición local */ };
```

`Branch` y `Rama` describen el mismo concepto del mundo real con claves
distintas y sin ninguna relación de tipos. TypeScript no puede advertir nada:
son universos disjuntos. El backend sí resuelve la ambigüedad, con un mapa de
alias en `ramas.ts` (`LOBATO` y `MANADA` apuntan ambos a `manada`), pero ese
conocimiento no cruza al frontend.

`lib/scouts.ts` se usa solo para identidad visual (colores y emblemas PNPJ en
`/diseno`, `lib/pnpj.ts`, `badges-demo.tsx`). `lib/units/types.ts` es el
contrato de datos con be_ruta.

## Decisiones

| # | Decisión | Alternativas descartadas |
|---|---|---|
| 1 | Espejo del manifiesto en ambos repos, verificado por hash | Paquete npm `@ruta/domain` (exige registry y ceremonia de publicación); git submodule (pelea con pnpm, CI y Vercel) |
| 2 | Alcance: vocabulario compartido FE/BE mas rutas del FE | Solo dominio (deja 28 rutas sueltas); incluir números (acopla módulos independientes a un god-object) |
| 3 | Guard: regla ESLint bloqueante mas `domain:check` de paridad | Solo paridad (no impide reintroducir literales); ESLint en `warn` con allowlist (las allowlists temporales se vuelven permanentes) |
| 4 | Paridad cruzada solo en desarrollo; CI valida coherencia interna | Hash publicado por el BE en `/health`; CI con checkout del repo hermano |
| 5 | Entrega en dos fases: be_ruta primero, fe_ruta después | Ambos en paralelo; cuatro PR separando dominio de rutas |

### Por qué los números NO entran

Los valores numéricos ya están nombrados como constantes locales al módulo que
los usa (`SESSION_MAX_AGE`, `MIN_CARACTERES_PASSWORD`, `RATE_LIMIT_MAX`,
`POWERSYNC_TOKEN_TTL_SECONDS`). Eso es correcto y se conserva.

**Regla que separa las aguas: se centraliza lo que es vocabulario compartido, no
lo que es parámetro de un módulo.** Un valor va al diccionario si cruza una
frontera (entre FE y BE, entre capas, o entre archivos que no se conocen). Si
vive y muere en un módulo, se queda ahí como constante nombrada. Centralizar
`RATE_LIMIT_MAX` acoplaría `password-reset.service.ts` a un archivo que importa
medio codebase, sin beneficio alguno.

## Arquitectura

### Fuente de verdad

```
work-around-ruta/
├── be_ruta/domain-manifest.json     ┐ byte a byte idénticos
└── fe_ruta/domain-manifest.json     ┘ (mismo SHA-256)
```

JSON y no TypeScript porque los repos tienen formatters distintos (be_ruta usa
prettier con comillas simples, fe_ruta con dobles). Un `.ts` "idéntico" se
pelearía con el formatter de uno de los dos en cada commit y la comparación por
hash moriría en una semana. JSON tiene una sola forma canónica.

### Generación

```
domain-manifest.json
    │
    └── pnpm domain:gen
            ├──► <dominio>/*.ts             constantes `as const`, tipos literales
            └──► .domain-vocabulary.json    literales prohibidos para ESLint
```

`<dominio>` es `be_ruta/src/domain/` y `fe_ruta/lib/domain/`.

`pnpm domain:check` regenera en memoria y falla si lo commiteado no coincide,
igual que `go generate` con verificación de diff.

Consecuencias buscadas:

- El módulo TypeScript no puede divergir del manifiesto: no se escribe a mano.
- La regla de ESLint no puede quedarse vieja: su lista de literales prohibidos
  sale del mismo JSON. Agregar una rama al manifiesto y regenerar deja el guard
  al día sin tocar la configuración del linter.
- Hay una sola cosa que mantener sincronizada entre repos, no tres.

El generador debe ser determinista: mismo JSON de entrada, mismo byte de salida,
respetando el formatter de cada repo (comillas simples en be_ruta, dobles en
fe_ruta). El estilo de salida es responsabilidad del generador, no de un
`prettier --write` posterior.

### Contenido del manifiesto

```json
{
  "version": 1,
  "branches": [
    { "key": "familia",   "order": 1, "siscoutAliases": ["FAMILIA", "CACHORRO", "CACHORROS"] },
    { "key": "manada",    "order": 2, "siscoutAliases": ["MANADA", "LOBATO", "LOBATOS"] },
    { "key": "tropa",     "order": 3, "siscoutAliases": ["TROPA", "SCOUT", "SCOUTS"] },
    { "key": "comunidad", "order": 4, "siscoutAliases": ["COMUNIDAD", "NOMADA", "NOMADA SCOUT", "NOMADAS SCOUT"] },
    { "key": "clan",      "order": 5, "siscoutAliases": ["CLAN", "ROVER", "ROVERS"] }
  ],
  "accessStates": ["sin_solicitud", "pendiente", "aprobado", "rechazado", "suspendido"],
  "accessLevels": ["rama", "grupo", "region", "nacion", "super_admin"],
  "roleLevels": ["rama", "grupo", "region", "nacion"],
  "personTypes": ["adulto", "protagonista"],
  "permissions": [
    { "key": "role:read", "side": "both" }
  ],
  "apiErrorCodes": ["UNITS.LEADERSHIP_REQUIRED", "UNITS.MISSING_GROUP", "VALIDATION.INVALID_INPUT"]
}
```

Los 21 permisos actuales salen tal cual de `src/authz/permissions.catalog.ts`.
El manifiesto conserva solo `key` y `side`.

Las descripciones de los permisos **se quedan** en `permissions.catalog.ts`, no
se mudan a i18n. El proyecto ya decidió esto: `src/i18n/catalog.ts` documenta
que los catálogos de dominio quedan fuera del i18n a propósito por ser "datos,
no mensajes", y esas descripciones viajan al frontend por HTTP en
`/roles/permissions`. Por el mismo criterio, las 33 etiquetas de `CARGOS` en
`src/catalogo-cargos/catalogo-cargos.ts` tampoco se tocan.

### Frontera: qué entra al manifiesto y qué no

Al manifiesto solo va lo que cruza la frontera FE/BE. Lo demás vive en el módulo
de dominio de cada repo, sin espejo.

| Qué | Dónde | Por qué |
|---|---|---|
| Claves de rama, estados, niveles, permisos, códigos de error | Manifiesto (espejo) | Viajan en el payload HTTP |
| Etiquetas visibles (`Manada`, `Lobatos`) | Catálogo i18n de cada repo | Es texto de usuario y ya tiene su casa |
| Colores y emblemas PNPJ | `fe_ruta/lib/pnpj.ts` | Presentación, solo FE |
| `ROUTES` de navegación | `fe_ruta/lib/domain/routes.ts` | Solo FE, no cruza |
| `ENDPOINTS` del BFF | `fe_ruta/lib/domain/endpoints.ts` | El BE los declara con decoradores de Nest; derivarlos acoplaría el generador al framework |

**El diccionario de dominio no duplica i18n: lo indexa.** Hoy las etiquetas de
rama están hardcodeadas dos veces (`BRANCH_LABELS` en fe_ruta, `ETIQUETA_RAMA`
en be_ruta y otra vez en `lib/scouts.ts`). Las tres mueren. La etiqueta se
resuelve con `t(K.BRANCH[branch])`, con claves i18n derivadas de la misma clave
canónica. Si se agrega una rama sin su texto, `i18n:check` lo detecta.

### Resolución de la colisión de ramas

Clave canónica: la del contrato con el backend, `familia | manada | tropa |
comunidad | clan`.

| Hoy | Después |
|---|---|
| `fe_ruta/lib/units/types.ts` → `Branch` | Re-exporta el tipo generado |
| `fe_ruta/lib/scouts.ts` → `Rama` | Se elimina |
| `fe_ruta/components/playground/form-demo.tsx` → `const RAMAS` | Se elimina |
| `be_ruta/src/catalogo-cargos/ramas.ts` | Tipos y alias salen del generado; conserva `normalizar()` y `ramaDeEtiquetaSiscout()` |

`"Lobatos"` deja de ser una clave y pasa a ser lo que siempre fue: el nombre del
protagonista de la rama `manada`. Un atributo, no una identidad paralela.

Consumidores a re-indexar por la clave canónica: `fe_ruta/lib/pnpj.ts`,
`fe_ruta/app/diseno/page.tsx`, `fe_ruta/components/playground/badges-demo.tsx`.

### Guard

Regla `no-restricted-syntax` en el flat config de ambos repos (los dos ya usan
flat config, así que entra sin migración previa). La lista de literales
prohibidos se lee de `.domain-vocabulary.json`, generado desde el manifiesto.

Salida esperada:

```
app/(privado)/unidades/page.tsx
  42:18  error  Literal de dominio "aprobado". Usa D.ACCESS.APPROVED
                (no-restricted-syntax)
```

Excepciones declaradas:

- El módulo de dominio generado y el manifiesto.
- Los tests (`**/*.spec.ts`, `**/*.test.ts`): en una aserción de contrato se
  quiere ver `"aprobado"` literal. Si el test usa la constante, el test no
  prueba nada, se prueba a sí mismo.
- Las migraciones y seeds que reproducen datos históricos.

Precisión de la regla: prohíbe el literal en posición de comparación, asignación
y argumento; lo permite como nombre de propiedad (`{ grupo: ... }`) y dentro de
plantillas de texto. Los literales `grupo`, `region` y `rama` son los de mayor
riesgo de falso positivo por aparecer también como nombres de campo.

## Verificación de paridad

`domain:check` compara el hash del manifiesto contra el del repo hermano
(`../be_ruta/` o `../fe_ruta/`) cuando está presente, que es el caso en
desarrollo, donde ocurren los cambios.

En CI cada repo se clona solo, así que la paridad cruzada no se puede verificar.
Ahí el check valida coherencia interna y avisa explícitamente que la paridad
cruzada quedó sin verificar:

1. Manifiesto contra módulo generado (regeneración en memoria y diff).
2. Módulo generado contra los `enum` de Mongoose en be_ruta (`user.schema.ts`,
   `cargo.subschema.ts`): los enums deben consumir el generado, no listas
   propias.
3. Claves i18n presentes para cada entrada que necesita etiqueta.

**Riesgo residual aceptado:** cambiar el manifiesto en un repo y no en el otro
no lo detecta ningún CI hasta que falla en runtime. Se aceptó a cambio de no
montar infraestructura cruzada. Mitigación posible a futuro, si el riesgo se
materializa: publicar el hash del manifiesto en `GET /health` del backend y
compararlo desde `lib/backend/client.ts` al arrancar.

## Plan de entrega

### Precondición

be_ruta tiene trabajo sin commitear en la rama `feat/scaffold-recursos-mongoose`
(`src/unidades/alcance-unidades.ts`, `src/unidades/unidades.service.ts` y
`src/seeds/seed-mock-nacion.ts` sin rastrear). `alcance-unidades.ts` es uno de
los archivos que este refactor toca. La Fase 1 arranca desde una base limpia:
ese trabajo se cierra o se aparta primero.

### Fase 1: be_ruta

Es el dueño del dato, así que define el vocabulario.

1. `domain-manifest.json` con el vocabulario actual extraído de las constantes existentes.
2. `scripts/domain-gen.ts` y `scripts/domain-check.ts`.
3. `src/domain/` generado.
4. Regla ESLint alimentada por `.domain-vocabulary.json`.
5. Migración de los literales de `src/`: **164 apariciones medidas** (excluyendo
   `*.spec.ts`). Es una cota superior: incluye usos que no se migran, como
   `grupo` en posición de nombre de propiedad. `user.schema.ts` y
   `cargo.subschema.ts` pasan a consumir el generado en sus `enum` de Mongoose.
6. `permissions.catalog.ts` consume el generado; las descripciones se mudan a i18n.
7. `domain:gen` y `domain:check` entran en `pnpm verify`.
8. `pnpm verify` en verde antes de mergear.

### Fase 2: fe_ruta

1. Copia del manifiesto ya estable (mismo hash verificado por `domain:check`).
2. Generador, check y regla ESLint, espejo de la Fase 1.
3. Migración de los literales de `app/`, `components/`, `lib/` y `scripts/`:
   **135 apariciones medidas** (excluyendo `*.test.ts`), también cota superior.
4. Colapso de las tres definiciones de rama en una, y re-indexación de
   `lib/pnpj.ts`, `/diseno` y `badges-demo.tsx`.
5. `ROUTES` (11 rutas de navegación) y `ENDPOINTS` (17 del BFF).
6. `BRANCH_LABELS` y `ETIQUETA_RAMA` mueren; las etiquetas salen de i18n.
7. `domain:check` entra en el job `verificar` de CI, junto a tsc, lint y test.
8. Verificación visual de `/diseno` y del playground con la skill
   `verificar-visual` (Claude in Chrome), porque la re-indexación de ramas toca
   superficie visual.

## Criterios de aceptación

- `rg` sobre ambos repos, excluyendo tests, el módulo de dominio y el
  manifiesto, no encuentra ningún literal del vocabulario.
- `pnpm domain:check` falla si se edita el módulo generado a mano.
- `pnpm domain:check` falla si los manifiestos de los dos repos divergen,
  estando ambos presentes.
- `pnpm lint` falla ante un literal de dominio reintroducido en código de
  producción.
- Existe una sola definición de rama por repo, derivada del manifiesto.
- `pnpm verify` (be_ruta) y el job `verificar` (fe_ruta) pasan en verde.
- `/diseno` y el playground se ven igual que antes del refactor.

## Convenciones aplicadas

- Identificadores del código nuevo en inglés (decisión 2026-07-07 de
  `fe_ruta/AGENTS.md`): las claves del diccionario son inglés UPPER_SNAKE
  (`D.ACCESS.APPROVED`), los valores son los strings reales del contrato en
  español (`"aprobado"`). Mismo patrón que el catálogo i18n.
- Sin comentarios salvo un porqué no evidente.
- Conventional Commits en español con scope, sin co-authors ni atribución de IA.
