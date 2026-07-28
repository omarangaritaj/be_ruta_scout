# Recursos de rol y asignación de roles — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un rol otorgue rutas del frontend además de permisos, que el menú y la protección de páginas se deriven de esas rutas, y que se pueda asignar un rol a una persona desde la aplicación.

**Architecture:** El catálogo de rutas vive en `domain-manifest.json`, idéntico en los dos repos, porque el backend valida lo que llega y el frontend lo pinta. `Role.resources: string[]` guarda las rutas concedidas y se resuelve con el mismo `granting()` que ya usan los permisos, comodines incluidos. El menú de `app/(privado)/layout.tsx` deja de tener condicionales escritos a mano y se deriva del catálogo.

**Tech Stack:** NestJS 11 + Mongoose + Zod + Jest (be_ruta) · Next.js 16 App Router + shadcn base-mira + Vitest (fe_ruta).

**Rama:** `feat/role-resources`, creada desde `feat/units` en `be_ruta` y `fe_ruta`. `powersync` no se toca.

## Global Constraints

- **Sin comentarios en el código.** Solo un "por qué" no evidente. Nada narrativo.
- **Todo el código en inglés**: identificadores, archivos, estructuras de datos. La prosa (i18n, documentación, commits) en español.
- **Nunca em dashes** en texto de cara al usuario.
- **Los commits NO llevan `Co-Authored-By` ni atribución a IA.** Conventional Commits en español **con tildes**, con scope.
- **pnpm siempre.** `be_ruta` usa jest, `fe_ruta` usa vitest con `environment: "node"` (no se pueden testear componentes React).
- **`components/ui/` no se toca**: espejo de shadcn upstream.
- **NO ejecutar nada contra la base de datos.** `MONGODB_URI` apunta a MongoDB Atlas con datos reales.
- Verificación `be_ruta`: `pnpm verify`. Verificación `fe_ruta`: `tsc --noEmit`, `lint`, `test`, `i18n:check`, `domain:check`.
- Los dos `domain-manifest.json` deben quedar **idénticos byte a byte** (lo verifica `domain:check` por SHA-256).

## Decisiones ya tomadas por el usuario

| Decisión | Elegido |
|---|---|
| Modelo | `Role.resources: string[]` **separado** de `permissions`, con dos fuentes de verdad |
| Alcance | Las tres piezas: asignar roles, control por rutas, checkbox de seleccionar todos |
| Rutas sin conceder | Denegadas por defecto |
| Comodín | `*` funciona igual que en permisos, vía `granting()` |
| `/tablero` | `always: true`, accesible a toda persona aprobada sin importar su rol |

El usuario conoce y acepta el riesgo de las dos fuentes de verdad: un rol puede tener `/units` sin `unit:read`. La mitigación acordada es **avisar en la UI**, no bloquear.

## Estructura de archivos

### `be_ruta`

| Archivo | Responsabilidad |
|---|---|
| `domain-manifest.json` | Bloque `routeResources` |
| `scripts/domain-codegen.ts` | Emitir `ROUTE_RESOURCES` y su tipo |
| `src/authz/route-resources.catalog.ts` | Catálogo y `isValidRouteResource` |
| `src/roles/schemas/role.schema.ts` | Campo `resources` |
| `src/roles/dto/*.dto.ts` | Validación de `resources` |
| `src/roles/roles.controller.ts` | Endpoint del catálogo de rutas |

### `fe_ruta`

| Archivo | Responsabilidad |
|---|---|
| `lib/domain/` | `ROUTE_RESOURCES` generado desde el manifiesto |
| `lib/auth.ts` | `requireRoute(path)` |
| `lib/nav/build-nav.ts` | Deriva el menú del catálogo. Puro |
| `app/(privado)/layout.tsx` | Consume `buildNav`, sin condicionales a mano |
| `components/app/rol-form.tsx` | Rutas, checkbox por sección, aviso de incoherencia |
| `components/app/admin/role-picker.tsx` | Asignar roles a una persona |
| `lib/roles/coherence.ts` | Detecta rutas sin sus permisos. Puro |

---

## Task 1: `routeResources` en el manifiesto

**Files:**
- Modify: `be_ruta/domain-manifest.json`, `be_ruta/scripts/domain-codegen.ts`
- Copy: `fe_ruta/domain-manifest.json`
- Regenerate: `be_ruta/src/domain/`, `fe_ruta/lib/domain/`

**Interfaces:**
- Produces: `ROUTE_RESOURCES: readonly RouteResource[]` y el tipo `RouteResource = { path: string; label: string; section?: string; always?: boolean }`.

- [ ] **Step 1: Añadir el bloque al manifiesto**

En `be_ruta/domain-manifest.json`, después de `permissions`:

```json
  "routeResources": [
    { "path": "/tablero", "label": "Tablero", "always": true },
    { "path": "/aprobaciones", "label": "Aprobaciones" },
    { "path": "/units", "label": "Unidades" },
    { "path": "/admin/usuarios", "label": "Usuarios", "section": "Administración" },
    { "path": "/admin/roles", "label": "Roles", "section": "Administración" }
  ],
```

Las rutas deben coincidir **exactamente** con los valores de `ROUTES` en `fe_ruta/lib/domain/routes.ts`. Compruébalo antes de seguir.

- [ ] **Step 2: Enseñar al generador a emitirlo**

`scripts/domain-codegen.ts` trata los vocabularios como `NamedValue` (`name` + `value`), y `routeResources` no tiene esa forma. **Sigue el patrón de `permissions`**, que ya es un bloque con forma propia (`{key, side}`): mira cómo se declara en la interfaz del manifiesto, cómo se valida su unicidad y cómo se emite, y replícalo.

Emite `ROUTE_RESOURCES` como array de objetos y el tipo `RouteResource`. **No** lo añadas a `.domain-vocabulary.json`: ese archivo alimenta la regla de lint que bloquea literales de dominio, y las rutas sí se escriben literalmente en el código de navegación.

- [ ] **Step 3: Ejecutar el test del generador**

Run: `cd be_ruta && pnpm exec jest scripts/domain-codegen.spec.ts`
Expected: PASS. Si falla porque el snapshot no contempla el bloque nuevo, **actualiza el caso con la salida esperada; no lo borres ni lo debilites**.

- [ ] **Step 4: Copiar y regenerar en los dos repos**

```bash
cp be_ruta/domain-manifest.json fe_ruta/domain-manifest.json
cd be_ruta && pnpm domain:gen && pnpm domain:check
cd ../fe_ruta && pnpm domain:gen && pnpm domain:check
sha256sum be_ruta/domain-manifest.json fe_ruta/domain-manifest.json
```

Expected: los dos `domain:check` en verde y los hashes idénticos.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(dominio): agregar el catálogo de rutas como recurso de rol"
```

---

## Task 2: `Role.resources` en el backend

**Files:**
- Create: `be_ruta/src/authz/route-resources.catalog.ts`
- Modify: `be_ruta/src/roles/schemas/role.schema.ts`, `dto/create-role.dto.ts`, `dto/update-role.dto.ts`, `roles.controller.ts`
- Test: `be_ruta/src/authz/route-resources.catalog.spec.ts`

**Interfaces:**
- Consumes: `ROUTE_RESOURCES` (Task 1).
- Produces: `isValidRouteResource(value: string): boolean`, campo `Role.resources: string[]`, endpoint `GET /roles/resources`.

- [ ] **Step 1: Escribir el test del validador**

```ts
import { isValidRouteResource } from './route-resources.catalog';

describe('isValidRouteResource', () => {
  it('acepta una ruta del catalogo', () => {
    expect(isValidRouteResource('/units')).toBe(true);
  });

  it('acepta el comodin total', () => {
    expect(isValidRouteResource('*')).toBe(true);
  });

  it('rechaza una ruta que no existe', () => {
    expect(isValidRouteResource('/inventada')).toBe(false);
  });

  it('rechaza una ruta con barra final que no esta en el catalogo', () => {
    expect(isValidRouteResource('/units/')).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `cd be_ruta && pnpm exec jest src/authz/route-resources.catalog.spec.ts`
Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Implementar el catálogo**

`src/authz/route-resources.catalog.ts` exporta `ROUTE_RESOURCE_PATHS` (los `path` del catálogo) e `isValidRouteResource`, que acepta el comodín `*` y cualquier ruta del catálogo. Sigue el patrón de `src/authz/permissions.catalog.ts`, que ya hace lo mismo para los permisos.

- [ ] **Step 4: Añadir el campo al esquema**

En `role.schema.ts`, junto a `permissions`:

```ts
  @Prop({ type: [String], default: [] })
  resources: string[];
```

- [ ] **Step 5: Validar en los DTOs**

En `create-role.dto.ts` y `update-role.dto.ts`, replica el tratamiento que ya tiene `permissions` pero con `isValidRouteResource`: `.default([])` en creación, `.optional()` en actualización. **El `.default()` no puede vivir en un esquema compartido** entre ambos: el proyecto ya documentó por qué (un `.partial()` lo arrastraría al update y un PATCH que no menciona el campo lo vaciaría).

- [ ] **Step 6: Exponer el catálogo**

En `roles.controller.ts`, junto al endpoint que ya sirve el catálogo de permisos, añade `GET /roles/resources` con `@RequirePermissions('role:read')`, devolviendo `ROUTE_RESOURCES` completo (con `label`, `section` y `always`, que el frontend necesita para pintar).

- [ ] **Step 7: Verificar**

Run: `cd be_ruta && pnpm verify`
Expected: verde completo.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(roles): permitir conceder rutas del frontend como recurso"
```

---

## Task 3: Derivar el menú y proteger las rutas

**Files:**
- Create: `fe_ruta/lib/nav/build-nav.ts`, `lib/nav/build-nav.test.ts`
- Modify: `fe_ruta/lib/auth.ts`, `app/(privado)/layout.tsx`
- Modify: `fe_ruta/lib/backend/client.ts`, `lib/domain/endpoints.ts`

**Interfaces:**
- Consumes: `ROUTE_RESOURCES` (Task 1), `granting` de `lib/permisos`.
- Produces: `buildNav(resources: string[]): NavEntry[]` puro; `requireRoute(path: string)` en `lib/auth.ts`; `backend.roleResourcesCatalog(token)`.

- [ ] **Step 1: Escribir el test de `buildNav`**

```ts
import { buildNav } from "./build-nav";

describe("buildNav", () => {
  it("siempre incluye las rutas marcadas always, aunque el rol no las conceda", () => {
    const items = buildNav([]);
    expect(items).toEqual([{ href: "/tablero", label: "Tablero" }]);
  });

  it("incluye una ruta concedida", () => {
    const hrefs = buildNav(["/units"]).map((i) => "href" in i && i.href);
    expect(hrefs).toContain("/units");
  });

  it("omite una ruta no concedida", () => {
    const hrefs = buildNav(["/units"]).map((i) => "href" in i && i.href);
    expect(hrefs).not.toContain("/admin/roles");
  });

  it("el comodin total concede todas", () => {
    const hrefs = buildNav(["*"]).map((i) => "href" in i && i.href);
    expect(hrefs).toContain("/admin/roles");
    expect(hrefs).toContain("/aprobaciones");
  });

  it("emite el encabezado de seccion solo si hay alguna ruta de esa seccion", () => {
    const conAdmin = buildNav(["/admin/roles"]);
    expect(conAdmin.some((i) => "section" in i)).toBe(true);
    const sinAdmin = buildNav(["/units"]);
    expect(sinAdmin.some((i) => "section" in i)).toBe(false);
  });

  it("no repite el encabezado con dos rutas de la misma seccion", () => {
    const items = buildNav(["/admin/roles", "/admin/usuarios"]);
    expect(items.filter((i) => "section" in i)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `cd fe_ruta && pnpm exec vitest run lib/nav/build-nav.test.ts`
Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Implementar `buildNav`**

Recorre `ROUTE_RESOURCES` en su orden de declaración. Incluye una ruta si `always` es verdadero o si `granting(resources, path)` lo concede. Emite el encabezado de sección **antes del primer ítem** de esa sección y solo una vez. Los `label` salen del catálogo, no del código.

- [ ] **Step 4: Añadir `requireRoute`**

En `lib/auth.ts`, junto a `requirePermission`: `requireRoute(path)` obtiene el perfil, comprueba `always` o `granting(perfil.resources, path)`, y redirige igual que hace `requirePermission` cuando no concede.

Investiga cómo llegan hoy los permisos al perfil (`mapPerfil`) y añade `resources` por el mismo camino. El backend debe incluirlas en la respuesta de `/auth/me`: si no lo hace, es parte de esta tarea.

- [ ] **Step 5: Recablear el layout**

En `app/(privado)/layout.tsx`, sustituye el bloque de `if (puede(...))` por `const items = buildNav(perfil.resources)`. El menú deja de escribirse a mano.

- [ ] **Step 6: Proteger las páginas por ruta**

Añade `await requireRoute("<ruta>")` en las páginas del catálogo, **junto a** su `requirePermission` actual, no en su lugar. Son dos preguntas distintas: la ruta dice si puede abrir la pantalla, el permiso si puede hacer la acción. Es la consecuencia del modelo de dos fuentes que se eligió.

- [ ] **Step 7: Verificar**

Run: `cd fe_ruta && pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm i18n:check && pnpm domain:check`
Expected: los cinco en verde.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(nav): derivar el menú y el acceso a páginas del catálogo de rutas"
```

---

## Task 4: Rutas y checkbox de sección en el formulario de rol

**Files:**
- Create: `fe_ruta/lib/roles/coherence.ts`, `lib/roles/coherence.test.ts`
- Modify: `fe_ruta/components/app/rol-form.tsx`
- Modify: `fe_ruta/app/(privado)/admin/roles/nuevo/page.tsx`, `[id]/page.tsx`, `actions.ts`
- Modify: `fe_ruta/lib/i18n/catalogo.ts`

**Interfaces:**
- Consumes: `ROUTE_RESOURCES`, `CheckboxList` de `@/components/collection`.
- Produces: `missingPermissionsFor(routes: string[], permissions: string[]): RouteWarning[]`, con `RouteWarning = { path: string; missing: string }`.

- [ ] **Step 1: Escribir el test de coherencia**

```ts
import { missingPermissionsFor } from "./coherence";

describe("missingPermissionsFor", () => {
  it("avisa cuando una ruta concedida no trae su permiso de lectura", () => {
    expect(missingPermissionsFor(["/units"], [])).toEqual([
      { path: "/units", missing: "unit:read" },
    ]);
  });

  it("no avisa cuando el permiso esta presente", () => {
    expect(missingPermissionsFor(["/units"], ["unit:read"])).toEqual([]);
  });

  it("acepta el comodin de recurso", () => {
    expect(missingPermissionsFor(["/units"], ["unit:*"])).toEqual([]);
  });

  it("acepta el comodin total", () => {
    expect(missingPermissionsFor(["/units"], ["*"])).toEqual([]);
  });

  it("no avisa de las rutas always, que no exigen permiso", () => {
    expect(missingPermissionsFor(["/tablero"], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `cd fe_ruta && pnpm exec vitest run lib/roles/coherence.test.ts`
Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Implementar la coherencia**

Necesitas saber qué permiso exige cada ruta. Declara ese mapa **en el mismo módulo**, no en el manifiesto: es una heurística de la interfaz para avisar al usuario, no vocabulario que el backend valide.

```ts
const READ_PERMISSION_BY_ROUTE: Record<string, string> = {
  "/aprobaciones": "solicitud:read",
  "/units": "unit:read",
  "/admin/usuarios": "user:read",
  "/admin/roles": "role:read",
};
```

Una ruta `always` o ausente del mapa no produce aviso. Usa `granting` para respetar los comodines.

- [ ] **Step 4: Añadir las claves i18n**

En `lib/i18n/catalogo.ts`, bloque `ROLES` (créalo si no existe), en orden alfabético:

```ts
    RESOURCES_LABEL: "Páginas a las que da acceso",
    RESOURCES_SEARCH: "Buscar página...",
    SECTION_SELECT_ALL: "Seleccionar todo",
    WARNING_MISSING_PERMISSION:
      "Esta página necesita el permiso {missing} para mostrar algo.",
```

Run: `cd fe_ruta && pnpm i18n:check`

- [ ] **Step 5: Añadir el selector de rutas al formulario**

En `components/app/rol-form.tsx`, una sección nueva con `CheckboxList` sobre `ROUTE_RESOURCES`, agrupada por `section`. Las rutas `always` se muestran marcadas y **deshabilitadas**: se conceden solas y desmarcarlas no significaría nada.

El campo del formulario se llama `resources` y viaja en el `FormData`, como ya hace `permissions`.

- [ ] **Step 6: Añadir el checkbox de sección**

Cada grupo de permisos (que `rol-form.tsx` ya agrupa por recurso con `permiso.key.split(":")[0]`) y cada grupo de rutas lleva una casilla de cabecera que marca o desmarca todo el grupo. Debe mostrar estado **indeterminado** cuando la selección es parcial. Es solo interfaz: no viaja al backend.

- [ ] **Step 7: Mostrar el aviso de incoherencia**

Junto a cada ruta marcada cuyo permiso falte, pinta el texto de `WARNING_MISSING_PERMISSION` interpolando el permiso. **No bloquea el guardado**: informa.

- [ ] **Step 8: Pasar los catálogos y guardar**

Las dos páginas (`nuevo` y `[id]`) obtienen el catálogo de rutas con `backend.roleResourcesCatalog` y se lo pasan al formulario. `actions.ts` recoge `formData.getAll("resources")` igual que hace con `permissions`.

- [ ] **Step 9: Verificar**

Run: `cd fe_ruta && pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm i18n:check`
Expected: en verde.

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(roles): elegir páginas y marcar secciones completas al editar un rol"
```

---

## Task 5: Asignar roles a una persona

**Files:**
- Create: `fe_ruta/components/app/admin/role-picker.tsx`
- Modify: `fe_ruta/app/(privado)/admin/usuarios/page.tsx`, `actions.ts`
- Modify: `fe_ruta/lib/backend/client.ts`
- Modify: `fe_ruta/lib/i18n/catalogo.ts`

**Interfaces:**
- Consumes: `CheckboxList`, `backend.listRoles`.
- Produces: server action `assignRoles(userId, roleIds)`.

El backend **ya lo soporta**: `PATCH /users/:id` acepta `roles: ObjectId[]` (`be_ruta/src/users/dto/update-user.dto.ts:44`). Esta tarea es solo la interfaz y la frontera del cliente.

- [ ] **Step 1: Comprobar qué expone el backend**

```bash
cd be_ruta && rg -n "roles" src/users/queries/*.ts src/users/users.service.ts | head
```

Averigua si la respuesta de `/users` ya incluye los roles de cada persona. Si no, esta tarea incluye añadirlos: sin eso la interfaz no puede mostrar el estado actual. Dilo en el informe.

- [ ] **Step 2: Añadir el método al cliente**

En `lib/backend/client.ts`, `assignRoles(token, userId, roleIds)` con `PATCH` sobre el endpoint de usuario, enviando `{ roles: roleIds }`. Si no existe `listRoles`, añádelo también.

- [ ] **Step 3: Añadir las claves i18n**

```ts
    ASSIGN_ROLES: "Roles",
    ASSIGN_ROLES_EMPTY: "Todavía no hay roles creados.",
    ASSIGN_ROLES_SEARCH: "Buscar rol...",
    COULD_NOT_ASSIGN_ROLES: "No se pudieron guardar los roles.",
```

- [ ] **Step 4: Escribir el selector**

`components/app/admin/role-picker.tsx`, cliente, con `CheckboxList` sobre los roles disponibles y los del usuario marcados. Botón de guardar deshabilitado mientras no cambie nada.

- [ ] **Step 5: Escribir la server action**

En `actions.ts`, `assignRoles` con `requirePermission("user:update")` si ese permiso existe en el catálogo; si no, con el que el backend exija para `PATCH /users/:id` (compruébalo en `users.controller.ts`, **no lo adivines**). Sigue el patrón de las demás: `readTokens`, llamada al backend, captura de `BackendError`, `revalidatePath`.

- [ ] **Step 6: Montarlo en la pantalla de usuarios**

Añade el selector donde encaje con la tabla existente, envuelto en `<Can permission="...">` con el mismo permiso de la action.

- [ ] **Step 7: Verificar**

Run: `cd fe_ruta && pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm i18n:check`

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(usuarios): asignar roles a una persona desde el panel"
```

---

## Verificación final

- [ ] Un rol sin ninguna ruta concedida deja ver solo `/tablero`.
- [ ] Un rol con `/units` muestra Unidades en el menú y deja abrir la página.
- [ ] Una ruta no concedida no aparece en el menú **y** rechaza el acceso directo por URL.
- [ ] El comodín `*` concede todas las rutas.
- [ ] El encabezado "Administración" aparece solo si hay alguna ruta de esa sección, y una sola vez.
- [ ] El checkbox de sección marca y desmarca todo el grupo, con estado indeterminado en selección parcial.
- [ ] Marcar `/units` sin `unit:read` muestra el aviso y **permite** guardar.
- [ ] Se puede asignar y quitar roles a una persona, y el cambio se refleja al recargar.
- [ ] `pnpm verify` en be_ruta y la batería completa de fe_ruta, en verde.
- [ ] Los dos `domain-manifest.json` con el mismo SHA-256.
