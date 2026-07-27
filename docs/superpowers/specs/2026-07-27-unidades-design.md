# Unidades: siembra, configuración y separación

Fecha: 2026-07-27
Repos afectados: `be_ruta`, `fe_ruta`, `powersync/`

## Objetivo

Dejar operativa la sección de unidades: sembrarlas automáticamente a partir de los
datos sincronizados de SiScout, permitir que cada jefatura las configure la primera
vez que entra, y permitir separar una unidad en varias cuando la rama tiene más
protagonistas de los que caben en un solo equipo.

De paso se traduce el módulo completo al inglés, según la convención vigente del
proyecto (código y estructuras de datos en inglés).

## Contexto: qué existe hoy

- Colección `unidades` con campos en español: `nombre`, `rama`, `groupId`,
  `idJefeUnidad`, `dirigentes`, `protagonistas`.
- Índice `{groupId: 1, rama: 1}` **único**. Un grupo admite como mucho una unidad
  por rama.
- `UnidadesService.provisionar()` crea la unidad de la rama la primera vez que
  alguien de esa rama entra a `/unidades`.
- `AlcanceUnidades` resuelve qué unidades ve cada quien: `all`, `grupo`, `rama`,
  `jefatura-requerida`, `sin-grupo`. Se conserva tal cual (solo se traduce).
- `User.idUnidad` existe y `powersync/sync-config.yaml` lo usa como parámetro de
  bucket. `Unidad.protagonistas[]` existe en paralelo y nadie sincroniza ambos.
- Permisos `unidad:read|create|update|delete` en `domain-manifest.json`, persistidos
  como strings en `roles.permissions`.

## Decisiones

| Decisión | Elegido |
|---|---|
| Alcance de la traducción | Módulo completo, incluidas URL, endpoint y permisos |
| Fuente de verdad de la membresía | `User.unitId`, `Unit.members[]` y `unit_memberships` sincronizados en transacción |
| Origen de las unidades | Seed masivo por CLI, con creación al entrar como respaldo |
| Ubicación de componentes nuevos | `components/collection/`, con demo en `/diseno/componentes` |
| Detección de primera configuración | Campo explícito `configuredAt?: Date` |
| Protagonistas desmarcados | Nunca quedan sin unidad: se crea una unidad clon automática |
| Alcance del bucket de PowerSync | Colección de unión `unit_memberships`, un bucket por unidad |

## Invariante central

> **Todo protagonista de una rama pertenece siempre a exactamente una unidad de esa
> rama de su grupo.**

No existe el estado "protagonista sin unidad". Todas las reglas de abajo son
consecuencia de esta invariante, y por eso no hay casos especiales que recordar.

Consecuencias directas:

1. Desmarcar miembros y guardar no los deja huérfanos: nace una unidad clon con
   ellos. Esto es lo que el usuario llamó "separar la unidad en dos".
2. No existe un "crear unidad vacía desde cero". Una unidad nueva nace siempre de
   separar una existente, nunca en blanco.
3. **Una unidad SÍ puede quedar con cero miembros**, y es la única vía para
   borrarla. Desmarcar a todos los protagonistas los manda a una unidad clon, la
   unidad de origen queda vacía, y entonces se puede eliminar.

### Borrado de unidades (revisado el 2026-07-27)

> **Una unidad se puede borrar si y solo si tiene cero miembros.**

La invariante que se protege no es "toda unidad tiene protagonistas", sino
**"todo protagonista está en alguna unidad"**. Son cosas distintas: una unidad
vacía no viola nada, un protagonista huérfano sí.

Las dos situaciones en que una unidad llega legítimamente a cero, ambas descritas
por el usuario:

- Todos sus protagonistas se movieron a otra unidad de la rama.
- La rama se quedó sin protagonistas (nadie quedó por asignar).

Por eso `PATCH /units/:id/members` **acepta una lista vacía**. Los que salen van a
la unidad clon, como cualquier otra separación; la diferencia es que aquí salen
todos. `DELETE /units/:id` conserva su guard, pero ahora es alcanzable.

Lo que sigue prohibido es borrar una unidad **que tenga protagonistas dentro**:
eso sí los dejaría huérfanos y no hay forma de repararlo, porque la siembra de
respaldo solo actúa cuando el grupo no tiene ninguna unidad.

## Modelo de datos

### Colección `units` (antes `unidades`)

```ts
@Schema({ collection: 'units', timestamps: true })
export class Unit {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: BRANCHES, required: true, index: true })
  branch: Branch;

  @Prop({ type: Number, required: true, index: true })
  groupId: number;

  @Prop({ type: Number, index: true })
  districtId?: number;

  @Prop({ trim: true })
  districtName?: string;

  @Prop({ trim: true })
  city?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  unitLeaderId: Types.ObjectId;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  leaders: Types.ObjectId[];

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  members: Types.ObjectId[];

  @Prop({ type: Date })
  configuredAt?: Date;
}

UnitSchema.index({ groupId: 1, name: 1 }, { unique: true });
```

Mapa de renombrado:

| Antes | Ahora |
|---|---|
| `nombre` | `name` |
| `rama` | `branch` |
| `idJefeUnidad` | `unitLeaderId` |
| `dirigentes` | `leaders` |
| `protagonistas` | `members` |
| (nuevo) | `districtId`, `districtName`, `city`, `configuredAt` |

`districtId` se llama así, y no `idDistrict`, porque es el nombre que ya usa
`User.districtId`. Dos nombres para el mismo dato en dos colecciones es un error
que se paga después.

El índice `{groupId, rama}` **se elimina**. El índice `{groupId, name}` único lo
sustituye y es además la norma de negocio pedida: no se repite nombre de unidad
dentro del mismo grupo.

### Colección `users`

`idUnidad` pasa a `unitId`. Sigue siendo `ObjectId` opcional con referencia a la
unidad del protagonista. Deja de ser lo que acota el bucket de PowerSync, según la
sección de PowerSync.

### Colección `unit_memberships` (nueva)

```ts
@Schema({ collection: 'unit_memberships', timestamps: true })
export class UnitMembership {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Unit', required: true })
  unitId: Types.ObjectId;

  @Prop({ type: String, enum: UNIT_ROLES, required: true })
  role: UnitRole;

  @Prop({ type: Number, required: true, index: true })
  groupId: number;
}

UnitMembershipSchema.index({ userId: 1, unitId: 1 }, { unique: true });
UnitMembershipSchema.index({ unitId: 1 });
```

`UNIT_ROLES` es `['unit_leader', 'assistant', 'member']`:

| Valor | Quién | Origen en `units` |
|---|---|---|
| `unit_leader` | Jefe de unidad | `unitLeaderId` |
| `assistant` | Subjefe | `leaders[]` |
| `member` | Protagonista | `members[]` |

Es una **proyección derivada**, no una cuarta decisión de modelo: existe porque
PowerSync no admite arrays embebidos como parámetro de bucket y necesita una fila
por par persona-unidad. Se mantiene en la misma transacción que escribe `units` y
`users`, y se puede reconstruir entera desde `units` si se corrompe.

`UNIT_ROLES` entra en `domain-manifest.json` como `UNIT_ROLE`, porque estos valores
bajan al SQLite del dispositivo y el frontend los lee en `/campo/*`. Es vocabulario
que cruza la frontera, así que le aplica la regla del diccionario.

### Jefe y subjefes (confirmado)

El modal de configuración pide un **jefe de unidad** (desplegable, selección única)
y unos **subjefes** (checkbox, selección múltiple). Se mapean así:

- Jefe de unidad, o jefe de rama, → `unitLeaderId`. Corresponde al cargo scout
  `JEFE DE <RAMA>` del catálogo.
- Subjefes → `leaders`. Es el mismo array que en el planteamiento inicial se
  describió con el label "dirigentes". Corresponde al cargo `SUB-JEFE DE <RAMA>`.

No son dos listas distintas: son un desplegable y un array. **No existe una tercera
lista de dirigentes genéricos**, y por eso `UNIT_ROLES` tiene exactamente tres
valores.

Ambos controles listan los adultos activos del grupo. La persona elegida como jefe
queda excluida de la lista de subjefes: no se puede ser jefe y subjefe a la vez.

## Backend

### Estructura

```
be_ruta/src/units/
  seeding/
    unit-seeder.ts          Lógica única de siembra
    unit-seeder.spec.ts
    leader-resolution.ts    Orden de búsqueda del jefe (puro)
    leader-resolution.spec.ts
  units.service.ts
  units.controller.ts
  units.module.ts
  unit-scope.ts             Antes alcance-unidades.ts
  schemas/unit.schema.ts
  schemas/unit-membership.schema.ts
  dto/
be_ruta/src/tools/seed-units.ts                CLI: pnpm seed:units
be_ruta/src/tools/rebuild-unit-memberships.ts  Reconstruye la proyección
be_ruta/src/tools/migrate-units-rename.ts      Migración del renombrado
```

### Siembra

`UnitSeeder.seedGroup(groupId)` es la lógica única. La invocan tanto el CLI como el
respaldo del service, para que no existan dos algoritmos que puedan divergir.

Pasos por grupo:

1. Cargar los usuarios activos del grupo (`estado: true`). Si no hay ninguno, no se
   siembra y se reporta.
2. Clasificar los protagonistas por rama con `branchFromSiscoutLabel(cargoSiscout)`,
   que ya existe. Las ramas sin protagonistas no generan unidad.
3. Por cada rama con protagonistas, crear una unidad:
   - `name`: `"cambiar nombre unidad <rama>"`.
   - `members`: los protagonistas de esa rama.
   - `unitLeaderId`: resultado de la resolución de jefe (abajo).
   - `districtId` y `districtName`: heredados del primer usuario del grupo que los
     tenga.
   - `city`: se deja vacío. Lo aporta la persona en el modal.
   - `configuredAt`: ausente, para que la unidad dispare el modal.
   - `leaders`: vacío.
4. Escribir `unitId` en cada protagonista y crear sus filas en `unit_memberships`
   (`member` por cada protagonista, `unit_leader` por el jefe resuelto), todo en la
   misma transacción.

### Resolución del jefe de unidad

Orden de búsqueda, primer escalón que dé resultado:

1. **Jefe de rama**: adulto con cargo de nivel `rama` cuya rama coincida. Prioriza
   `JEFE DE <RAMA>` sobre `SUB-JEFE DE <RAMA>`. Busca primero en `User.cargos`
   (asignación propia de la plataforma) y luego en `User.cargoSiscout`.
2. **Jefe de grupo**: `JEFE DE GRUPO`, y si no, `SUBJEFE DE GRUPO`.
3. **Colaborador de grupo**: adulto cuyo `cargoSiscout` normalizado contenga
   `COLABORADOR`.
4. **Cualquier adulto activo del grupo.**

Desempate dentro de un mismo escalón: orden alfabético por `name`, para que la
siembra sea determinista y los tests reproducibles.

> **Hallazgo**: el cargo "colaborador de grupo" **no existe** en
> `src/catalogo-cargos/catalogo-cargos.ts`. Los cargos catalogados son los de nivel
> rama, grupo, región y nación, y ninguno es colaborador. Por eso el escalón 3 se
> resuelve por coincidencia sobre el texto libre de `cargoSiscout` y no por
> catálogo. Si SiScout no reporta ese texto, el escalón simplemente no encuentra a
> nadie y se cae al escalón 4.

Si el grupo no tiene **ningún** adulto, no se puede satisfacer `unitLeaderId`, que
es obligatorio. El seeder salta ese grupo y lo incluye en el reporte final del CLI.

### Endpoints

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| `GET` | `/units` | `unit:read` | Unidades según el alcance. Si el grupo no tiene ninguna, siembra y devuelve |
| `GET` | `/units/:id` | `unit:read` | Documento de la unidad. Las listas de personas las pone PowerSync |
| `POST` | `/units/leadership` | `unit:read` | Declarar jefatura de rama. Existe hoy como `/unidades/jefatura` |
| `PATCH` | `/units/:id/configure` | `unit:update` | Modal de primera vez: nombre, jefe, subjefes, ciudad. Sella `configuredAt` |
| `PATCH` | `/units/:id/members` | `unit:update` y `unit:create` | Guarda la selección de miembros y separa si hace falta |
| `PATCH` | `/units/:id` | `unit:update` | Edición posterior de la unidad |
| `DELETE` | `/units/:id` | `unit:delete` | Elimina la unidad |

`POST /units` se elimina: crear una unidad vacía violaría la invariante. La creación
ocurre siempre como consecuencia de `PATCH /units/:id/members`, y por eso ese
endpoint exige también `unit:create`. El permiso no queda huérfano: sigue siendo el
que autoriza a separar una unidad.

### `PATCH /units/:id/members`

Cuerpo: `{ memberIds: string[] }`, la lista de quienes **permanecen** en la unidad.

Algoritmo, todo dentro de una transacción:

1. `memberIds` **puede venir vacío**: significa que salen todos y la unidad queda
   lista para borrarse. No se rechaza.
2. Validar que todo id enviado pertenezca a los miembros actuales de la unidad. No
   se admite incorporar gente de otras unidades por esta vía.
3. Calcular los salientes: miembros actuales menos `memberIds`.
4. Si no hay salientes, actualizar y terminar.
5. Si los hay, crear la unidad clon: misma `branch`, `groupId`, `districtId`,
   `districtName` y `city` que la origen; `unitLeaderId` heredado; `leaders`
   vacío; `configuredAt` ausente; `members` los salientes.
6. `name` de la clon: `"cambiar nombre unidad <rama> <n>"`, donde `n` es el menor
   entero mayor o igual a 2 que produzca un nombre libre en ese grupo.
7. Escribir `unitId` de los salientes apuntando a la clon.
8. Actualizar `members` de la origen.
9. Reasignar en `unit_memberships` las filas `member` de los salientes a la clon, y
   crear la fila `unit_leader` de la clon.

La clon nace sin `configuredAt`, así que al abrirla dispara el mismo modal de
configuración que una unidad recién sembrada. Un solo mecanismo para los dos
orígenes.

### Transacciones

Cada operación que toca `units`, `users` y `unit_memberships` corre dentro de
`session.withTransaction()`. Son tres escrituras coordinadas: el documento de la
unidad, el puntero `unitId` de cada persona y las filas de membresía. Es el costo
de la denormalización elegida, y por eso la transacción no es opcional.

> **Requisito de infraestructura**: `be_ruta` no usa transacciones hoy, y las
> transacciones de MongoDB exigen un replica set. El `.env.example` apunta a
> `mongodb://localhost:27017/...`, un `mongod` standalone, donde fallarían con
> `Transaction numbers are only allowed on a replica set member or mongos`. En
> Atlas funcionan sin cambios. Para desarrollo local hay que arrancar con
> `--replSet rs0` y ejecutar `rs.initiate()` una vez. Se documenta en el README de
> `be_ruta`.

## Frontend

### Rutas

`app/(privado)/unidades/` pasa a `app/(privado)/units/`.

| Ruta | Contenido | Origen de los datos |
|---|---|---|
| `/units` | Listado de tarjetas por unidad | SSR |
| `/units/[id]` | Detalle. Si falta `configuredAt`, abre el modal | PowerSync (cliente) |

### De dónde salen los datos de cada pantalla

**El listado sigue siendo SSR.** No puede ser de otra forma: un super admin, un
nivel nación o un nivel región ven **todas** las unidades por `resolveUnitScope`, y
PowerSync solo les bajaría aquellas en las que tienen membresía. Solo el servidor
sabe resolver el alcance completo.

**El detalle lee de PowerSync**, contra el SQLite local:

```sql
SELECT * FROM users WHERE unitId = ? AND tipo = 'protagonista' ORDER BY name
SELECT * FROM users WHERE groupId = ? AND tipo = 'adulto' ORDER BY name
```

La primera consulta sale del bucket `units_of_the_member`, la segunda de
`adults_of_the_group`. El componente es cliente, envuelto en `PowerSyncProvider`,
con `useQuery` igual que `components/campo/asistencia-cliente.tsx`.

**Las escrituras siguen yendo al backend por server action**, no por la cola de
PowerSync. Guardar miembros crea unidades y escribe en tres colecciones dentro de
una transacción: eso no es una escritura encolable, es una operación de negocio. Sin
señal se puede leer la unidad, pero no reorganizarla.

Esto **extiende** la decisión de `AGENTS.md` de que solo `/campo/*` es offline. El
detalle de unidad pasa a ser lectura offline y escritura online. Hay que actualizar
esa sección de `AGENTS.md` al implementar.

### Modal de configuración

Se abre solo, sin poder descartarse, cuando `configuredAt` está ausente. Campos:

| Campo | Control | Destino |
|---|---|---|
| Nombre de la unidad | `input` | `name` |
| Jefe de unidad | desplegable de adultos del grupo | `unitLeaderId` |
| Subjefes | lista con checkbox de adultos del grupo | `leaders` |
| Ciudad o municipio | `input` | `city` |

Validación antes de guardar: nombre no vacío y único dentro del grupo, y jefe
seleccionado. El conflicto de nombre se resuelve en el servidor por el índice único
y vuelve como error de campo.

Al guardar, `PATCH /units/:id/configure` sincroniza también `unit_memberships`:
reemplaza la fila `unit_leader` si cambió el jefe, y recalcula las filas `assistant`
contra la nueva lista de subjefes. Las tres escrituras van en la misma transacción.

### Detalle de la unidad

Lista los miembros actuales con checkbox, todos marcados de entrada. Desmarcar y
guardar es lo que separa la unidad. La UI avisa antes de guardar cuántos
protagonistas saldrán y que se creará una unidad nueva con ellos.

**Desmarcar a todos está permitido**: es la vía para vaciar la unidad y poder
borrarla. El aviso en ese caso dice que saldrán todos y que la unidad quedará
vacía.

El botón de eliminar la unidad aparece **solo cuando la unidad ya está vacía**, no
cuando el usuario ha desmarcado a todos sin guardar todavía. Primero se guarda (los
protagonistas se van a la clon), y con la unidad ya en cero se ofrece eliminarla.

### Componente nuevo

`components/collection/checkbox-list.tsx`: lista de selección múltiple con búsqueda
y contador, compuesta sobre primitivas que ya están en el banco (`checkbox`,
`input`, `scroll-area`, `badge`). Se usa en los subjefes del modal y en los miembros
del detalle.

Acompañan: `components/playground/checkbox-list-demo.tsx` y su tarjeta en
`app/diseno/componentes/page.tsx`.

`components/ui/` no se toca: es el espejo de shadcn upstream y meterle componentes
propios rompe la paridad en cada `shadcn add`.

## PowerSync

### El problema

Las reglas actuales acotan el bucket con el puntero del propio usuario:

```yaml
unidad_del_dirigente:
  parameters:
    - SELECT idUnidad FROM users
      WHERE _id = request.user_id() AND idUnidad IS NOT NULL
```

Tiene tres fallas, y las tres las agrava este cambio:

1. **Los dirigentes no tienen puntero.** Hoy nadie escribe `User.idUnidad`, y los
   adultos viven en `Unidad.dirigentes[]`. La parameter query devuelve vacío para un
   dirigente, así que no baja nada. El bucket está roto desde antes.
2. **Devuelve una sola unidad.** Un subjefe puede dirigir varias, y a partir de este
   cambio un grupo puede tener varias unidades por rama.
3. **Referencia `idUnidad`**, que pasa a llamarse `unitId`.

### La solución

`unit_memberships` da exactamente lo que PowerSync necesita: una fila por par
persona-unidad. La parameter query devuelve N filas y PowerSync crea N buckets, uno
por unidad. Un subjefe de tres unidades baja las tres, y solo las tres.

### `sync-config.yaml`

```yaml
bucket_definitions:
  global_reference:
    data:
      - SELECT _id as id, * FROM cargos

  adults_of_the_group:
    parameters:
      - SELECT groupId FROM users
        WHERE _id = request.user_id() AND groupId IS NOT NULL
    data:
      - SELECT _id as id, * FROM users
        WHERE groupId = bucket.groupId AND tipo = 'adulto'
      - SELECT _id as id, * FROM units
        WHERE groupId = bucket.groupId

  units_of_the_member:
    parameters:
      - SELECT unitId FROM unit_memberships
        WHERE userId = request.user_id()
    data:
      - SELECT _id as id, * FROM unit_memberships
        WHERE unitId = bucket.unitId
      - SELECT _id as id, * FROM users
        WHERE unitId = bucket.unitId
      - SELECT _id as id, * FROM asistencia
        WHERE unitId = bucket.unitId
      - SELECT _id as id, * FROM progresion
        WHERE unitId = bucket.unitId
      - SELECT _id as id, * FROM diagnostico
        WHERE unitId = bucket.unitId
```

Cambios respecto de lo actual, uno por uno:

- Los buckets se nombran en inglés: `referencia_global` pasa a `global_reference`.
- El parámetro de `units_of_the_member` sale de `unit_memberships` en vez de
  `users`, que es lo que arregla las tres fallas de arriba.
- Aparece `adults_of_the_group`, acotado por `groupId`. Baja **solo los adultos** y
  las unidades del grupo. Ningún dato de menores viaja por este bucket.
- `idUnidad` pasa a `unitId` en las tres colecciones de campo.

### Por qué hacen falta dos buckets

Los datos de menores se acotan por **membresía**: un protagonista solo baja al
dispositivo de quien está en su unidad. Los adultos y las unidades se acotan por
**grupo**, porque sin ellos la pantalla de configuración no se puede pintar y,
peor, la unidad quedaría bloqueada.

El caso que lo obliga: el seed asigna un solo jefe por unidad. Si esa persona nunca
entra a la app, con un único bucket por membresía nadie más tendría datos, nadie
podría abrir el modal y la unidad sería **imposible de configurar para siempre**.
Con `adults_of_the_group`, cualquier dirigente del grupo puede entrar, reasignar la
jefatura y guardarse a sí mismo como jefe o subjefe. Al hacerlo obtiene membresía y
a partir de ahí ya baja los protagonistas.

Esto respeta la asimetría correcta: para tocar los datos de un menor hay que
pertenecer a su unidad; para organizar quién dirige qué, basta con ser adulto del
grupo.

Las colecciones `asistencia`, `progresion` y `diagnostico` **todavía no existen** en
`be_ruta`: el archivo sigue siendo andamiaje en esa parte, tal como está hoy. Se
conservan sus nombres en español porque renombrarlas es trabajo del modelo de
programa, no de este. Cuando se creen, deben nacer en inglés.

### Espejo local

`fe_ruta/lib/powersync/schema.ts` declara la tabla `asistencia` con `idUnidad`. Se
renombra el campo a `unitId` para que case con el sync, y se añaden las tablas
`units` y `unit_memberships`, que ahora bajan al dispositivo.

### Reconstrucción

`be_ruta/src/tools/rebuild-unit-memberships.ts` regenera `unit_memberships` desde
cero leyendo `units`. Sirve para la migración inicial y como reparación si las tres
escrituras quedaran descuadradas. Es idempotente.

## Renombrado

**No hay migración de datos.** La base se borra y se vuelve a sembrar desde cero:

```bash
mongosh "$MONGODB_URI" --eval "db.dropDatabase()"
pnpm seed:super-admin
pnpm seed:siscout-import
pnpm seed:units
```

Esto elimina de un plumazo el renombrado de campos en `unidades`, el de `idUnidad`
en `users`, el reemplazo de los permisos en `roles.permissions` y el cambio de
índices: todo nace ya con la forma nueva. Es posible porque los datos provienen de
SiScout y se regeneran con el sync, así que no hay nada irrecuperable en Mongo.

El renombrado del **código** sí hay que hacerlo, en este orden:

1. **`domain-manifest.json` en los dos repos**: permisos `unidad:*` a `unit:*` y
   vocabulario `unitRoles`. Los dos archivos deben seguir siendo idénticos byte a
   byte, lo verifica el SHA-256 de `pnpm domain:check`. Regenerar `lib/domain/` y
   `src/domain/` con `pnpm domain:gen` en cada repo.
2. **`be_ruta`**: 166 ocurrencias en 29 archivos.
3. **`fe_ruta`**: 88 ocurrencias en 23 archivos.
4. **`powersync/`**: `sync-config.yaml` reescrito según la sección de PowerSync, y
   el espejo local de `fe_ruta/lib/powersync/schema.ts`.

> **Trampa**: la cadena `unidad` está contenida dentro de `comunidad`, que es una
> rama del dominio. Un reemplazo global de `unidad` por `unit` convierte `comunidad`
> en `comunit` y rompe el diccionario. El renombrado va archivo por archivo, con
> revisión, nunca con un `sd` global.

Los textos de cara al usuario siguen en español y salen del catálogo i18n. Renombrar
el código no cambia una sola palabra de lo que lee un dirigente.

## Riesgos y puntos abiertos

- **Tres escrituras coordinadas**: `units`, `users` y `unit_memberships` se escriben
  juntas en cada operación. Si la transacción falla a medias, Mongo revierte, pero
  un fallo de código que solo actualice dos de las tres deja datos descuadrados sin
  que nadie se entere. Mitigación: `rebuild-unit-memberships.ts` reconstruye la
  proyección, y los tests cubren que las tres queden consistentes.
- **Traslado de protagonistas entre unidades existentes**: no está cubierto. Solo se
  puede separar hacia una unidad nueva. Si hace falta mover gente entre dos unidades
  ya creadas, es un trabajo aparte.
- **`Grupo.ciudad` ya existe** en la colección `grupos` y no se usa como origen de
  `Unit.city`. El modal la pide a mano, según lo pedido. Podría precargarse desde el
  grupo en una iteración posterior.

## Fuera de alcance

- Renombrar otras colecciones o campos en español fuera del módulo de unidades.
- Crear las colecciones de campo (`asistencia`, `progresion`, `diagnostico`). El
  `sync-config.yaml` las sigue referenciando como andamiaje, igual que hoy.
- Limpiar o modificar `components/ui/`.
- Cualquier commit: se harán cuando se indique explícitamente.

## Criterios de aceptación

1. `pnpm seed:units` siembra las unidades de todos los grupos con usuarios, crea una
   unidad por rama con protagonistas, asigna jefe según el orden de búsqueda y
   reporta los grupos que saltó y por qué.
2. Entrar a `/units` con un grupo sin unidades las siembra en el momento con la
   misma lógica del CLI.
3. Abrir una unidad sin `configuredAt` muestra el modal, y al guardarlo persiste
   nombre, jefe, subjefes y ciudad, y sella `configuredAt`.
4. Guardar el detalle con miembros desmarcados crea una unidad nueva con los
   salientes, con nombre libre y sin `configuredAt`, y deja a cada protagonista con
   `unitId` apuntando a su unidad.
5. Ningún protagonista puede quedar sin unidad, ni por UI ni por API. Una unidad
   sí puede quedar con cero miembros: es la única vía para borrarla, según la
   sección "Borrado de unidades".
6. Dos unidades del mismo grupo no pueden compartir nombre, garantizado por índice.
7. Tras cualquier operación sobre unidades, `unit_memberships` refleja exactamente
   el `unitLeaderId`, los `leaders[]` y los `members[]` de cada unidad. Correr
   `rebuild-unit-memberships.ts` después no produce ningún cambio.
8. La parameter query de `units_of_the_member` devuelve tantas filas como unidades
   tenga la persona, y un subjefe de dos unidades recibe los dos buckets.
9. `pnpm domain:check`, `pnpm i18n:check`, `tsc --noEmit`, lint y tests en verde en
   los dos repos.
10. `grep` de `unidad` en el código de ambos repos solo devuelve textos en español,
    la rama `comunidad` y las colecciones de campo aún no creadas.
