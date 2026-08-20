# Inventario de módulos — be_ruta v2

Origen: `work-around-ruta/be_ruta` (NestJS 11 + Mongoose/MongoDB + Redis).
Destino: este repo (NestJS 11 + **TypeORM/PostgreSQL** + Redis + **socket.io**).

Hallazgos estructurales del sistema anterior que definen la migración:

- **La persistencia es 100% Mongoose.** No hay SQL en ninguna parte: toda la capa de datos se reescribe contra PostgreSQL.
- **No existe socket.io ni ningún gateway hoy.** El tiempo real es funcionalidad nueva de v2, no una migración.
- **PowerSync en el BE es pequeño**: un endpoint de write-batch, un token corto y un JWKS. Reemplazarlo es barato.
- **`src/domain` es codegen** desde `domain-manifest.json`, compartido byte a byte con el FE (verificación SHA-256). Es la pieza más reutilizable.
- La validación es **Zod 4** (`ZodValidationPipe`), no class-validator. Se conserva.

## Estado de este scaffold

Ya portado y funcionando en v2:

| Pieza v2 | Origen | Cambio |
| --- | --- | --- |
| [src/config/](src/config/) | `be_ruta/src/config/` | Rescatado tal cual; env: fuera `MONGODB_URI`/`POWERSYNC_*`, entra `DATABASE_URL` + `SUPABASE_DATABASE_URL` + `CORS_ORIGINS`. La validación keyring se simplificó a regex hasta portar `src/crypto` |
| [src/database/](src/database/) | `be_ruta/src/database/` | `MongooseModule` → `TypeOrmModule` (`autoLoadEntities`, `synchronize: false`, esquema por migraciones) + `data-source.ts` para la CLI |
| [src/main.ts](src/main.ts) | `be_ruta/src/main.ts` | + `enableCors` (el navegador ahora llama directo, ya no hay BFF) |
| [docker-compose.dev.yml](docker-compose.dev.yml) | nuevo | Postgres 16 + Redis 8 locales para desarrollo |

## Inventario por módulo (28 módulos del sistema anterior)

Leyenda: ✅ portar tal cual · 🔁 portar reescribiendo persistencia (Mongoose → TypeORM) · ⛔ eliminar/reemplazar.

### Base sin persistencia (portar primero, casi sin cambios)

| Módulo | Origen (`be_ruta/src/`) | Acción | Notas |
| --- | --- | --- | --- |
| domain | `domain/` + `domain-manifest.json` + `scripts/domain-*.ts` | ✅ | Codegen. Restaurar también el guard ESLint de vocabulario (`.domain-vocabulary.json`) desactivado en este scaffold |
| i18n | `i18n/` + `scripts/i18n-check.ts` | ✅ | Motor ICU propio sin dependencias, es-CO. Quitar el dominio `POWERSYNC` del catálogo |
| crypto | `crypto/` | ✅ | Keyring con rotación, `FieldCipher`, `CedulaHasher`. Al portarlo, restaurar `keyringEnv` en `src/config/env.schema.ts` |
| common | `common/` | ✅ | Excepciones con código i18n + `CodedExceptionFilter` + `ZodValidationPipe`. ⚠️ Sustituir `parse-object-id.pipe.ts` y `object-id.schema.ts` por equivalentes UUID |
| catalogo-cargos | `catalogo-cargos/` | ✅ | Catálogo en código, sin BD. `GET /cargos?nivel=` |
| email | `email/` | ✅ | Puertos `EMAIL_SENDER`/`EMAIL_NOTIFIER` + adapter Resend + plantillas React Email. Sin BD |
| config | `config/` | ✅ hecho | Ver arriba |
| redis | `redis/` | ✅ | ioredis con degradación con gracia. Reutilizable para `@socket.io/redis-adapter` si hay varias instancias |
| app-settings | `app-settings/` | 🔁 | Colección `app_config` → tabla singleton |

### Núcleo de identidad y permisos (orden estricto)

| Módulo | Origen | Acción | Persistencia nueva |
| --- | --- | --- | --- |
| users | `users/` | 🔁 | `users` + puentes `user_roles`, `user_cargos`; `idSiscout` UNIQUE, `cedulaHash` index. La agregación `queries/currentUser.query.ts` pasa a JOIN |
| roles | `roles/` | 🔁 | `roles` (+ `permissions`/`resources` como `text[]` o puentes). Preservar: anti-escalada en create/update, invalidación de cache por rol, borrado con reasignación |
| authz | `authz/` | 🔁 | Sin tablas propias. `populate('roles')` → JOIN. Guard de permisos, comodines (`*`, `role:*`), niveles `rama<grupo<region<nacion<super_admin`, anti-escalada — portar íntegro |
| current-user | `current-user/` | 🔁 | Cache Redis `current_user:{idSiscout}`, TTL = vida del access token. La query pasa a SQL |
| auth | `auth/` | 🔁 | JWT Bearer + refresh opaco (SHA-256 en `refresh_tokens`). ⚠️ El índice TTL de Mongo no existe en Postgres: job de limpieza (`@nestjs/schedule`) o `pg_cron`. ⛔ Eliminar `GET /auth/powersync-token`, `GET /auth/jwks`, `powersync-keys.ts`. ➕ Añadir auth del handshake de socket.io reutilizando `JwtStrategy` |

### Dominio scout

| Módulo | Origen | Acción | Persistencia nueva |
| --- | --- | --- | --- |
| grupos | `grupos/` | 🔁 | `grupos` + puente `grupo_dirigentes` |
| units | `units/` | 🔁 | `units` (UNIQUE `(groupId, name)`) + puente `unit_memberships` (UNIQUE `(userId, unitId)`), que define el **alcance de escritura**. Portar íntegros: `unit-scope.ts`, `membership-projection.ts`, `seeding/unit-seeder.ts`, `seeding/leader-resolution.ts` |
| questions | `questions/` | 🔁 | `questions` (branch, block, order, isActive) |
| growth-items | `growth-items/` | 🔁 | `growth_items` + índice compuesto para el upsert idempotente del seed |
| cycles | `cycles/` | 🔁 | `cycles` + hijas `cycle_diagnostic_answers`, `cycle_competencies` (o JSONB). Portar: `cycle-dates.ts`, `diagnostic-lock.ts`, `diagnostic-validation.ts` |
| opportunities | `opportunities/` | 🔁 | `learning_opportunities` (subdoc `competency` → columnas inline). ⚠️ comparte prefijo `@Controller('cycles')` con cycles |

### Flujos

| Módulo | Origen | Acción | Notas |
| --- | --- | --- | --- |
| solicitudes-acceso | `solicitudes-acceso/` | 🔁 | `solicitudes_acceso` + índice parcial anti-duplicados de pendientes. `territorio.ts` se porta íntegro. Candidato fuerte a socket.io (avisar al aprobador en vivo) |
| notificaciones | `notificaciones/` | 🔁 | `notificaciones` (`Mixed` → `jsonb`). Outbox pasivo hoy; candidato natural a push por socket.io en v2 |
| password-reset | `password-reset/` | 🔁 | `password_reset_tokens` (mismo problema de índice TTL que auth). Revoca todos los refresh al confirmar |

### Configuración dinámica

| Módulo | Origen | Acción | Notas |
| --- | --- | --- | --- |
| runtime-config | `runtime-config/` | ✨ | `app_config`: UN REGISTRO POR AJUSTE, agrupado por `group`. Cada fila carga sus metadatos (`type`, `constraints`, `label`) para que el panel del FE se pinte SOLO: añadir una configuración es declararla en el catálogo del módulo de dominio, sin migración ni formulario nuevo. Rutas `GET/PATCH /app-config/:group` y `POST /app-config/:group/reset`; el permiso lo resuelve el grupo. ⚠️ No confundir `RuntimeConfigService` (ajustes en base de datos) con `AppConfigService` de `config/` (variables de entorno) |

### Integración SiScout

| Módulo | Origen | Acción | Notas |
| --- | --- | --- | --- |
| siscout | `siscout/` | 🔁 | `siscout_snapshots` (`payload` cifrado → `jsonb`). El modelo NO se comparte con otros módulos (colección privada). Scheduler con cron reprogramable en caliente. Candidato a emitir progreso del sync por socket.io |
| siscout/config | `siscout/config/` | 🔁 | Fachada TIPADA sobre `app_config` (grupo `siscout`), editable en caliente, con `onChange()` para el scheduler. Ya no tiene entidad ni controlador propios |
| siscout/credentials | `siscout/credentials/` | 🔁 | `siscout_credentials` con password cifrada (`CREDENTIALS_CIPHER`) y **fuera del SELECT por defecto** |

### Reemplazo de PowerSync (funcionalidad nueva)

| Pieza anterior | Qué era | Reemplazo v2 |
| --- | --- | --- |
| `powersync/` (`POST /powersync/write`) | Write-batch idempotente de la tabla `asistencia`, con alcance por `unit_memberships` | Módulo `asistencia` propio: REST (`POST` bulk upsert idempotente + `DELETE`) conservando la misma comprobación de alcance. ⚠️ el `_id` de asistencia lo genera el cliente (UUID string) — conservar ese contrato |
| `GET /auth/powersync-token` + `GET /auth/jwks` | Token corto RS256 para el servicio PowerSync | ⛔ Se elimina sin reemplazo |
| (no existía) | — | **Gateway socket.io**: rooms por `unitId`, handshake autenticado con el mismo JWT, emisión de cambios de asistencia/solicitudes/notificaciones. `@socket.io/redis-adapter` sobre `REDIS_CLIENT` si se escala horizontal |

### Seeds y tools (al final)

| Origen | Acción |
| --- | --- |
| `seeds/seed-super-admin.ts` | 🔁 Rol `super_admin` (`permissions: ['*']`) + persona con bcrypt(12). Idempotente |
| `seeds/seed-growth-items.ts` + `seeds/data/growth-items.json` | 🔁 El JSON (29 KB) se reutiliza tal cual; el `bulkWrite` pasa a upserts SQL |
| `seeds/seed-siscout-import.ts` | 🔁 Importa volcado por el mismo camino del sync real |
| `tools/seed-units.ts`, `rebuild-unit-memberships.ts` | 🔁 |
| `tools/backfill-unit-leaders.ts` | ⛔ Existía por un bug de buckets de PowerSync |
| `tools/decrypt-snapshot.ts`, `anonymize-sample.ts` | ✅ El anonimizador es agnóstico |

## Mapa colecciones → tablas (17)

| Colección Mongo | Tabla(s) PostgreSQL | Nota |
| --- | --- | --- |
| `users` | `users`, `user_roles`, `user_cargos` | acudiente inline o jsonb |
| `roles` | `roles` | `permissions`/`resources` → `text[]` |
| `units` | `units`, + puentes de `leaders`/`members` | |
| `unit_memberships` | `unit_memberships` | puente natural, UNIQUE `(user_id, unit_id)` |
| `grupos` | `grupos`, `grupo_dirigentes` | |
| `cycles` | `cycles`, `cycle_diagnostic_answers`, `cycle_competencies` | |
| `learning_opportunities` | `learning_opportunities` | competency inline |
| `questions` | `questions` | directo |
| `growth_items` | `growth_items` | directo |
| `asistencia` | `asistencia` | ⚠️ PK string generada por el cliente |
| `solicitudes_acceso` | `solicitudes_acceso` | índice parcial de unicidad |
| `refresh_tokens` | `refresh_tokens` | TTL → job/`pg_cron` |
| `password_reset_tokens` | `password_reset_tokens` | TTL → job/`pg_cron` |
| `notificaciones` | `notificaciones` | datos → `jsonb` |
| `siscout_snapshots` | `siscout_snapshots` | payload cifrado → `jsonb` |
| `siscout_config` | `app_config` (grupo `siscout`) | dejó de ser singleton: un registro por ajuste |
| `siscout_credentials` | `siscout_credentials` | password nunca en SELECT por defecto |
| `app_config` | `app_config` | configuración dinámica por grupos, con metadatos |

Referencia de esquema adicional: `work-around-ruta/modelo-datos-programa.dbml`
(28 tablas de la Fase 2 "Programa", **ya escrito para PostgreSQL**) y las 22
migraciones de `work-around-ruta/fe_ruta/supabase/migrations/` (Fase 1/1.5).
⚠️ Ambos asumen `auth.users` de Supabase; en v2 la identidad la emite este
backend (JWT propio), así que esas referencias se adaptan a `users` local.

## Convenciones de API v2 (aplican a TODO módulo nuevo)

1. **Ningún endpoint devuelve un array raíz; SIEMPRE un objeto.** El campo
   lleva el nombre del recurso: `GET /roles` → `{ roles: [...] }`,
   `GET /questions` → `{ questions: [...] }`, `GET /users/regiones` →
   `{ regiones: [...] }`. Cuando el nombre sea muy ambiguo, usar
   `{ data: [...] }`. Razones: el contrato puede crecer (`total`, `meta`)
   sin romper clientes, y un array raíz es imposible de extender.
   Los endpoints ya envueltos: `/roles`, `/roles/permissions`,
   `/roles/resources`, `/users/regiones`, `/questions`, `/growth-items`,
   `/solicitudes-acceso`, `/cargos`. Los paginados ya eran objeto
   (`{ items, total, page, pageSize }`).
2. El desenvolvimiento vive en los clientes HTTP del FE (`lib/api/*`): los
   componentes reciben la misma forma de siempre.

## Relaciones entre modelos

Toda referencia entre tablas tiene su FK declarada, y **la regla de borrado es
una decisión de dominio, no un default**: `CASCADE` solo donde el hijo carece
de sentido sin su padre.

| Relación | Borrado | Por qué |
| --- | --- | --- |
| `users.unitId` → `units` | **SET NULL** | La unidad agrupa, no posee: borrarla no puede borrar a sus protagonistas |
| `units.leaderId` → `users` | **NO ACTION** | La columna es obligatoria; Postgres impide dar de baja al jefe hasta reasignar la unidad |
| `unit_leaders` / `unit_members` (puentes) | CASCADE | Filas de asociación: sin unidad o sin persona no significan nada |
| `unit_memberships.unitId` / `.userId` | CASCADE | Es una proyección derivada; se reconstruye con `units:rebuild-memberships` |
| `cycles.unitId` → `units` | CASCADE | El ciclo es de la unidad |
| `learning_opportunities.cycleId` → `cycles` | CASCADE | La oportunidad es del ciclo |
| `solicitudes_acceso.idPersona` → `users` | CASCADE | Sin la persona, su solicitud no tiene sujeto |
| `solicitudes_acceso.aprobadoPor` → `users` | **SET NULL** | Registro histórico de una decisión: sobrevive a la baja de quien la tomó |
| `refresh_tokens.userId` → `users` | CASCADE | Sesiones de esa persona |
| `user_roles` (puente) | CASCADE | Asignación de rol |

Relaciones inversas declaradas (solo navegación, no tocan el esquema):
`Unit.protagonistas`, `Unit.cycles`, `Unit.memberships`, `Cycle.opportunities`.

`Unit` y `User` se referencian mutuamente; las relaciones circulares usan
función diferida (`() => Unit`) y el tipo envuelto en `Relation<>`, que es como
TypeORM evita que el decorador reciba `undefined` al cargar los módulos.

### Referencias que a propósito NO son FK

No son un olvido: el sistema anterior las diseñó así y v2 lo conserva.

- **Catálogos citados dentro de jsonb con copia del texto**:
  `cycles.diagnosticAnswers[].questionId` + `questionText`,
  `cycles.focus.competencies[].growthItemId` + `text`,
  `learning_opportunities.competency.growthItemId` + `text`. El diagnóstico
  responde a la pregunta *tal como estaba redactada ese día*: si un
  administrador la edita o la desactiva, el ciclo cerrado no puede cambiar.
- **`notificaciones.destinatario.personaId`** (jsonb): el outbox es un registro
  de envío y debe sobrevivir a la baja de la persona.
- **`users.idSubgrupo`**: la tabla `subgrupos` es de la Fase 2 del modelo (ver
  `modelo-datos-programa.dbml`). La columna ya existe porque el padrón la
  proyecta; la relación se declara cuando exista la entidad.
- **`siscout_snapshots.idSiscout`**: se empareja con `users.idSiscout` (clave
  natural del padrón), no con el uuid; la tabla es privada y solo la lee
  `SiscoutSnapshotService`.

## Trampa del porte: los `default` de Mongoose son contrato de API

Un `@Prop({ type: [X], default: [] })` del sistema anterior **no era un detalle
de persistencia**: Mongoose materializaba ese arreglo en cada respuesta, y el
frontend lo recorre sin comprobar. Al pasar a jsonb la clave simplemente no
existe, y el componente copiado revienta con «... is undefined».

Ya ocurrió con `cycles.focus.competencies`. Al portar un módulo nuevo:

1. Busca en el schema original los `default: []` / `default: {}`.
2. Si el campo viaja al frontend, garantiza la forma en la **entidad** (default
   de la columna + un `@AfterLoad` que reponga lo que falte en filas viejas),
   no en cada método del servicio.
3. `@AfterLoad` no corre para entidades construidas en memoria: el `create()`
   debe fijar la forma explícitamente, porque la respuesta del POST se pinta
   sin pasar por una lectura.
4. Repara también las filas ya guardadas en la migración: el dato debe ser
   correcto en reposo, no solo al leerlo.

Auditado el resto de campos con este patrón (`users.cargos`,
`roles.permissions`/`resources`, `notificaciones.datos`/`destinatario`,
`siscout_credentials.alcance.zoneIds`, `units.leaders`/`members`): todos
materializan bien. Pendiente al portar `grupos` (`dirigentes: default []`).

## Decisiones de arquitectura v2

1. **TypeORM** como ORM: integración de primera clase con NestJS, migraciones nativas, y transición mental directa desde Mongoose (schema→entity, model→repository). Alternativas consideradas: Prisma (mejor DX de cliente, peor encaje con DI de Nest) y Drizzle (más liviano, menos maduro en Nest).
2. **PostgreSQL local en desarrollo, Supabase como Postgres remoto** vía `SUPABASE_DATABASE_URL`/`DATABASE_URL` — misma variable, distinta URL por entorno. La identidad NO usa Supabase Auth: la emite este backend, como en el sistema anterior.
3. **CORS abierto al origen del FE**: el navegador llama directo (el BFF de Next desaparece con el SSR). La autorización server-side (guards de permisos) pasa a ser la única línea de defensa — igual que ya lo era en la práctica.
4. **Los índices TTL de Mongo** (refresh y reset tokens) se sustituyen por un job de limpieza con `@nestjs/schedule` (ya está en las dependencias).

## Orden de reconstrucción sugerido

1. Base sin cambios: `domain` → `i18n` → `crypto` → `common` → `catalogo-cargos` → `email`
2. Infraestructura: `app-settings` → `redis` (config y database ya están)
3. Núcleo: `users` → `roles` → `authz` → `current-user` → `auth`
4. Dominio: `grupos` → `units` → `questions` + `growth-items` → `cycles` → `opportunities`
5. Flujos: `solicitudes-acceso` + `notificaciones` + `password-reset`
6. Integración: `siscout` (config → credentials → sync → scheduler)
7. Nuevo: módulo `asistencia` REST + gateway socket.io
8. Seeds y tools
