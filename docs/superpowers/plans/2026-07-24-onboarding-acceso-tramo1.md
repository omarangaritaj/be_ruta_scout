# Onboarding y solicitud de acceso — Plan de implementación (Tramo 1)

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar tarea por tarea. Los pasos usan
> checkbox (`- [ ]`).

**Goal:** Login por cédula (sin auth) y flujo de onboarding que crea una
solicitud de acceso, encolando una notificación — migrando el flujo SSR de `ruta`
a la API NestJS.

**Architecture:** Puertos y adaptadores. La cédula se busca por un HMAC
determinista (`cedulaHash`) alineado con el keyring de `src/crypto`; la cédula
real sigue cifrada en el snapshot. Las solicitudes viven en su colección; las
notificaciones se encolan en una colección outbox tras un puerto `Notificador`.

**Tech Stack:** NestJS 11, Mongoose 9, Zod 4, Jest (`.spec.ts` co-located).

## Global Constraints (copiar del spec / convenciones del repo)

- Identificadores de código en INGLÉS; comentarios y mensajes de error en
  español. Campos de dominio y de contrato de API en español.
- Colecciones en plural español, SIEMPRE con `@Schema({ collection: '...' })`.
- DTOs con Zod y `ZodValidationPipe`. Esquema base sin `.default()`; los defaults
  solo en el esquema de creación (evita el bug de `.partial()`).
- Value objects embebidos con `@Schema({ _id: false })`.
- Tests jest `.spec.ts` junto al código (`testRegex: .*\.spec\.ts$`).
- Sin auth ni autorización en este tramo.
- Verificación: `pnpm build`, `pnpm exec eslint src`, `pnpm test`.

⚠️ **Colisión activa:** el usuario está refactorizando `src/crypto`,
`src/config/env.schema.ts` y `src/siscout/siscout-sync.service.ts`. Las tareas 1
y 3 los tocan: **releer esos archivos al ejecutar**, no asumir el estado de este
plan.

---

### Task 1: `CedulaHasher` (HMAC de cédula) en el módulo crypto

**Files:**
- Create: `src/crypto/cedula-hasher.ts`
- Test: `src/crypto/cedula-hasher.spec.ts`
- Modify: `src/crypto/crypto.module.ts` (token `CEDULA_HASHER` + provider)
- Modify: `src/crypto/index.ts` (export `CedulaHasher`, `CEDULA_HASHER`)
- Modify: `src/config/env.schema.ts` (var `CEDULA_HASH_KEY`, formato keyring)
- Modify: `.env.example` (documentar `CEDULA_HASH_KEY`)

**Interfaces:**
- Produces: `class CedulaHasher { isReady(): boolean; hash(cedula: string): string }`
  — HMAC-SHA256 en hex con la clave activa del keyring. Normaliza (trim).
- Produces: token DI `CEDULA_HASHER` (string).

- [ ] **Step 1: Test que falla** — `src/crypto/cedula-hasher.spec.ts`

```ts
import { CedulaHasher } from './cedula-hasher';
import { parseKeyring } from './keyring';

const keyring = parseKeyring(Buffer.alloc(32, 1).toString('base64'), 'TEST');

describe('CedulaHasher', () => {
  const hasher = new CedulaHasher(keyring);

  it('es determinista: misma cédula → mismo hash', () => {
    expect(hasher.hash('1234567890')).toBe(hasher.hash('1234567890'));
  });

  it('normaliza espacios alrededor', () => {
    expect(hasher.hash('  1234567890 ')).toBe(hasher.hash('1234567890'));
  });

  it('cédulas distintas → hashes distintos', () => {
    expect(hasher.hash('111')).not.toBe(hasher.hash('222'));
  });

  it('clave distinta → hash distinto', () => {
    const otra = new CedulaHasher(
      parseKeyring(Buffer.alloc(32, 2).toString('base64'), 'TEST'),
    );
    expect(otra.hash('111')).not.toBe(hasher.hash('111'));
  });

  it('sin keyring, isReady() es false y hash() lanza', () => {
    const vacio = new CedulaHasher(null);
    expect(vacio.isReady()).toBe(false);
    expect(() => vacio.hash('111')).toThrow();
  });
});
```

- [ ] **Step 2: Correr y ver fallar** — `pnpm test -- cedula-hasher` → FAIL (no existe el módulo).

- [ ] **Step 3: Implementar** — `src/crypto/cedula-hasher.ts`

```ts
import { createHmac } from 'node:crypto';
import type { Keyring } from './keyring';

/**
 * Calcula un HMAC-SHA256 determinista de la cédula para poder buscarla sin
 * descifrarla. A diferencia de FieldCipher (AES-GCM con IV aleatorio, no
 * consultable), aquí el mismo valor produce siempre el mismo hash.
 *
 * Usa la clave ACTIVA del keyring. La cédula real nunca se guarda en claro;
 * el hash solo permite comprobar si una cédula concreta está presente.
 */
export class CedulaHasher {
  constructor(private readonly keyring: Keyring | null) {}

  isReady(): boolean {
    return this.keyring !== null;
  }

  hash(cedula: string): string {
    if (!this.keyring) {
      throw new Error('CEDULA_HASH_KEY no está configurada');
    }
    const key = this.keyring.active.key; // Buffer de 32 bytes
    return createHmac('sha256', key).update(cedula.trim()).digest('hex');
  }
}
```

> Nota de ejecución: confirmar la forma real de `Keyring` (`active.key` vs otro
> nombre) leyendo `src/crypto/keyring.ts`; ajustar el acceso a la clave.

- [ ] **Step 4: env** — en `src/config/env.schema.ts` añadir, junto a las otras
  claves: `CEDULA_HASH_KEY: optionalEnv(keyringEnv),` y documentar en `.env.example`.

- [ ] **Step 5: provider** — en `src/crypto/crypto.module.ts` añadir el token
  `export const CEDULA_HASHER = 'CEDULA_HASHER';` y un provider factory que
  construya `new CedulaHasher(raw ? parseKeyring(raw,'CEDULA_HASH_KEY') : null)`
  desde `CEDULA_HASH_KEY`; exportarlo. Exportar en `src/crypto/index.ts`.

- [ ] **Step 6: build + test + lint** — `pnpm build && pnpm test -- cedula-hasher && pnpm exec eslint src/crypto`

- [ ] **Step 7: Commit** — `git add src/crypto src/config/env.schema.ts .env.example && git commit -m "feat(crypto): añadir CedulaHasher (HMAC de cédula para búsqueda)"`

---

### Task 2: Campos de acceso en `User`

**Files:**
- Modify: `src/users/schemas/user.schema.ts`
- Test: `src/users/schemas/user.schema.spec.ts` (crear)

**Interfaces:**
- Produces: `ESTADOS_ACCESO`, `EstadoAcceso`, `NIVELES_ACCESO`, `NivelAcceso`.
- Produces: campos `User.cedulaHash?`, `User.estadoAcceso` (default
  `'sin_solicitud'`), `User.nivelAcceso?`.

- [ ] **Step 1: Test que falla** — `src/users/schemas/user.schema.spec.ts`

```ts
import { model } from 'mongoose';
import { User, UserSchema } from './user.schema';

const UserModel = model('UserTest', UserSchema);

describe('User — campos de acceso', () => {
  it('estadoAcceso por defecto es sin_solicitud', () => {
    const u = new UserModel({ name: 'A', tipo: 'adulto', idSiscout: 'X' });
    expect(u.estadoAcceso).toBe('sin_solicitud');
  });

  it('rechaza un nivelAcceso fuera del enum', () => {
    const u = new UserModel({
      name: 'A', tipo: 'adulto', idSiscout: 'X', nivelAcceso: 'planeta',
    });
    const err = u.validateSync();
    expect(err?.errors['nivelAcceso']).toBeDefined();
  });

  it('acepta rama como nivelAcceso', () => {
    const u = new UserModel({
      name: 'A', tipo: 'adulto', idSiscout: 'X', nivelAcceso: 'rama',
    });
    expect(u.validateSync()?.errors['nivelAcceso']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Ver fallar** — `pnpm test -- user.schema`

- [ ] **Step 3: Implementar** — en `user.schema.ts`, tras `TIPOS_PERSONA`:

```ts
export const ESTADOS_ACCESO = [
  'sin_solicitud', 'pendiente', 'aprobado', 'rechazado', 'suspendido',
] as const;
export type EstadoAcceso = (typeof ESTADOS_ACCESO)[number];

export const NIVELES_ACCESO = [
  'rama', 'grupo', 'region', 'nacion', 'super_admin',
] as const;
export type NivelAcceso = (typeof NIVELES_ACCESO)[number];
```

Y como campos de la clase `User`:

```ts
  /** HMAC de la cédula, para el login por cédula sin descifrar. Lo pone el sync. */
  @Prop({ trim: true, index: true })
  cedulaHash?: string;

  /** Acceso a la aplicación. Lo mueve el flujo de onboarding/aprobación. */
  @Prop({ type: String, enum: ESTADOS_ACCESO, default: 'sin_solicitud', index: true })
  estadoAcceso: EstadoAcceso;

  /** Alcance de acceso aprobado. Null hasta que se apruebe una solicitud. */
  @Prop({ type: String, enum: NIVELES_ACCESO })
  nivelAcceso?: NivelAcceso;
```

- [ ] **Step 4: Ver pasar** — `pnpm test -- user.schema`
- [ ] **Step 5: build + lint + commit** — `git commit -m "feat(users): añadir estadoAcceso, nivelAcceso y cedulaHash"`

---

### Task 3: El sync fija `cedulaHash`

**Files:**
- Modify: `src/siscout/siscout-sync.service.ts` (inyectar `CEDULA_HASHER`; en el
  upsert de usuario, `$set: { cedulaHash: hasher.hash(member.citizenship_card) }`
  cuando la cédula exista)
- Modify: `src/siscout/siscout.module.ts` si hace falta (CryptoModule es global,
  así que el token ya está disponible por inyección)
- Test: extender `src/siscout/siscout-sync.service.spec.ts` si existe, o verificar
  vía el guion de integración con mock.

**Interfaces:**
- Consumes: `CEDULA_HASHER` (token), `CedulaHasher.hash`.

- [ ] **Step 1** Releer el `siscout-sync.service.ts` ACTUAL (el usuario lo edita).
- [ ] **Step 2** Inyectar `@Inject(CEDULA_HASHER) private readonly cedulaHasher: CedulaHasher`.
- [ ] **Step 3** En `persistChunk`, dentro del `$set` del `updateOne` de usuario,
  añadir el hash cuando `member.citizenship_card` no sea null:
  `...(member.citizenship_card ? { cedulaHash: this.cedulaHasher.hash(member.citizenship_card) } : {})`.
- [ ] **Step 4** Verificar con el guion de integración (mock SiScout): tras un
  sync, `db.users.findOne(...).cedulaHash === HMAC(citizenship_card)`.
- [ ] **Step 5** build + lint + commit — `git commit -m "feat(siscout): el sync fija cedulaHash desde la cédula del snapshot"`

---

### Task 4: Catálogo de cargos (portar `lib/cargos.ts`)

**Files:**
- Create: `src/catalogo-cargos/catalogo-cargos.ts` (datos + `cargoEsValido`, `cargosPorNivel`)
- Create: `src/catalogo-cargos/catalogo-cargos.controller.ts` (`GET /cargos`)
- Create: `src/catalogo-cargos/catalogo-cargos.module.ts`
- Test: `src/catalogo-cargos/catalogo-cargos.spec.ts`
- Modify: `src/app.module.ts` (registrar el módulo)

**Interfaces:**
- Produces: `interface CargoCatalogo { cargo: string; etiqueta: string; nivel: NivelSolicitud }`
- Produces: `cargoEsValido(cargo: string, nivel: NivelSolicitud): boolean`
- Produces: `cargosPorNivel(nivel: NivelSolicitud): CargoCatalogo[]`
- Donde `NivelSolicitud = 'rama' | 'grupo' | 'region' | 'nacion'`.

> ⚠️ Portar los datos de `ruta/lib/cargos.ts` tal cual (nivel grupo|region|nacion).
> El nivel `rama` NO tiene cargos en el catálogo original: dejar `cargosPorNivel('rama')`
> devolviendo `[]` y anotar un TODO — los cargos de rama los define el usuario
> (dominio). No inventar.

- [ ] **Step 1: Test** — validar que un cargo conocido de nivel grupo pasa
  `cargoEsValido(cargo,'grupo')`, y que un cargo de otro nivel falla; que
  `cargosPorNivel('region')` no está vacío.
- [ ] **Step 2–4** Implementar datos + funciones + controller `GET /cargos?nivel=`.
- [ ] **Step 5** build + lint + test + commit — `git commit -m "feat(catalogo-cargos): catálogo de cargos por nivel y GET /cargos"`

---

### Task 5: Modelo `SolicitudAcceso`

**Files:**
- Create: `src/solicitudes-acceso/schemas/solicitud-acceso.schema.ts`
- Create: `src/solicitudes-acceso/solicitudes-acceso.module.ts`
- Test: `src/solicitudes-acceso/schemas/solicitud-acceso.schema.spec.ts`

**Interfaces:**
- Produces: `ESTADOS_SOLICITUD`, `EstadoSolicitud`, `RAMAS`, `Rama`, `SolicitudAcceso`,
  `SolicitudAccesoSchema`, `SolicitudAccesoDocument`.
- Colección `solicitudes_acceso`. Campos del spec: `idPersona` (ref User),
  `nivelSolicitado`, `cargoSolicitado`, `telefonoContacto`, `rama?`, `groupId?`,
  `districtId?`, `estado` (default `pendiente`), resolución (`aprobadoPor?`,
  `nivelAprobado?`, `cargoAprobado?`, `notaAprobador?`, `resueltoEn?`), timestamps.
- Índice único parcial: `(idPersona)` where `estado ∈ {pendiente,en_revision}`.

- [ ] **Step 1: Test** — default `estado='pendiente'`; enum de `estado` y `rama`
  rechaza basura; índice parcial declarado.
- [ ] **Step 2–4** Implementar schema + módulo (forFeature + exports).
- [ ] **Step 5** commit — `git commit -m "feat(solicitudes-acceso): modelo SolicitudAcceso"`

---

### Task 6: Notificaciones (puerto `Notificador` + adaptador outbox)

**Files:**
- Create: `src/notificaciones/schemas/notificacion.schema.ts` (colección `notificaciones`)
- Create: `src/notificaciones/notificador.port.ts` (`abstract class Notificador`)
- Create: `src/notificaciones/adapters/notificador-outbox.ts`
- Create: `src/notificaciones/notificaciones.module.ts`
- Test: `src/notificaciones/adapters/notificador-outbox.spec.ts`

**Interfaces:**
- Produces: `abstract class Notificador { encolar(n: NuevaNotificacion): Promise<void> }`
- Produces: `interface NuevaNotificacion { tipo: string; destinatario: { personaId?: string; correo?: string }; datos: Record<string, unknown> }`
- Produces: modelo `Notificacion` con `estado: pendiente|enviada|fallida`.
- El módulo liga `{ provide: Notificador, useClass: NotificadorOutbox }` y exporta `Notificador`.

- [ ] **Step 1: Test** — `NotificadorOutbox.encolar(...)` inserta un doc en
  `notificaciones` con `estado='pendiente'` y los datos dados (usar
  `mongodb-memory-server` si está, o mockear el model).
- [ ] **Step 2–4** Implementar puerto, adaptador, schema, módulo.
- [ ] **Step 5** commit — `git commit -m "feat(notificaciones): puerto Notificador con adaptador outbox"`

---

### Task 7: Login por cédula (`POST /auth/login`)

**Files:**
- Create: `src/auth/auth.service.ts`, `src/auth/auth.controller.ts`,
  `src/auth/auth.module.ts`, `src/auth/dto/login.dto.ts`
- Test: `src/auth/auth.service.spec.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `CEDULA_HASHER`, `User` model.
- Produces: `POST /auth/login { cedula }` →
  `{ persona: { id, name, tipo, estadoAcceso, nivelAcceso }, siguientePaso }`
  donde `siguientePaso: 'app' | 'onboarding' | 'suspendido'`.
- Regla: `aprobado`→`app`; `suspendido`→`suspendido`; resto→`onboarding`.
  Si no hay usuario con ese `cedulaHash` → 404.

- [ ] **Step 1: Test** — `auth.service.spec.ts`: dado un User con cierta cédula
  (mockear el model + hasher), `login(cedula)` devuelve `siguientePaso` correcto
  por cada `estadoAcceso`; cédula desconocida → `NotFoundException`.
- [ ] **Step 2–4** DTO Zod `{ cedula }`; service que hashea y busca por
  `cedulaHash`; controller `POST /auth/login` con `ZodValidationPipe`.
- [ ] **Step 5** Verificar por API (curl): login de una cédula sincronizada.
- [ ] **Step 6** commit — `git commit -m "feat(auth): login por cédula sin contraseña"`

---

### Task 8: Onboarding — crear solicitud (`POST /solicitudes-acceso`)

**Files:**
- Create: `src/solicitudes-acceso/solicitudes-acceso.service.ts`,
  `src/solicitudes-acceso/solicitudes-acceso.controller.ts`,
  `src/solicitudes-acceso/dto/crear-solicitud.dto.ts`
- Create: `src/solicitudes-acceso/territorio.ts` (resolver territorio con fallback)
- Test: `src/solicitudes-acceso/solicitudes-acceso.service.spec.ts`,
  `src/solicitudes-acceso/territorio.spec.ts`
- Modify: `solicitudes-acceso.module.ts` (controller, service, imports:
  UsersModule, NotificacionesModule, CatalogoCargosModule, SiscoutSnapshotService)

**Interfaces:**
- Consumes: `SolicitudAcceso` model, `User` model, `Notificador`, `cargoEsValido`,
  `SiscoutSnapshotService.findDecrypted` (para derivar territorio del snapshot).
- Produces: `POST /solicitudes-acceso { nivel, cargo, telefono, rama?, groupId?, districtId? }`.

- [ ] **Step 1: Test territorio** — `territorio.spec.ts`: si el snapshot tiene
  group_id/district_id suficientes para el nivel, se usan; si no, se toma lo del
  cliente; si falta lo requerido, error.
- [ ] **Step 2: Test service** — crear solicitud pone `estado='pendiente'`, fija
  `User.estadoAcceso='pendiente'`, encola una notificación `solicitud_recibida`;
  rechaza si ya hay solicitud activa; rechaza cargo inválido para el nivel.
- [ ] **Step 3–5** Implementar DTO (Zod: nivel∈rama|grupo|region|nacion, cargo,
  telefono con regex, territorio opcional), `territorio.ts`, service, controller.
- [ ] **Step 6** Verificar por API (curl): login→onboarding→solicitud creada;
  `db.notificaciones` tiene un `solicitud_recibida` pendiente.
- [ ] **Step 7** commit — `git commit -m "feat(solicitudes-acceso): crear solicitud de acceso (onboarding)"`

---

## Orden y dependencias

```
Task 1 (CedulaHasher) ─┬─> Task 3 (sync fija cedulaHash)
                       └─> Task 7 (login)
Task 2 (User acceso) ──> Task 7, Task 8
Task 4 (catálogo) ─────> Task 8
Task 5 (SolicitudAcceso) ─> Task 8
Task 6 (Notificaciones) ──> Task 8
```

Tareas 4, 5, 6 son independientes entre sí y NO tocan los archivos que el usuario
edita — pueden ir primero para avanzar sin colisión. Las tareas 1 y 3 tocan
crypto/env/sync (en refactor activo): releer al ejecutar.

## Self-review

- Cobertura del spec: login (T7), onboarding/solicitud (T8), cedulaHash (T1+T3),
  estadoAcceso/nivelAcceso (T2), solicitudes_acceso (T5), notificaciones outbox
  (T6), catálogo de cargos (T4), territorio con fallback (T8). ✓
- Gaps conocidos y anotados: cargos de nivel `rama` (no existen en el catálogo de
  ruta — decisión de dominio del usuario); aprobaciones (Tramo 2).
- Tipos consistentes: `NivelSolicitud` (rama|grupo|region|nacion) usado en T4 y T8;
  `NivelAcceso` (+super_admin) en T2/T7; `EstadoAcceso` en T2/T7/T8.
