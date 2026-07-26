# PowerSync self-hosted — offline-first de Ruta

Motor de sincronización para las **superficies de campo** de la app (asistencia,
progresión, diagnóstico y lectura de roster/ficha). Es la pieza del enfoque
**híbrido**: estas vistas funcionan sin señal contra una base local en el
dispositivo; el panel de administración sigue siendo SSR online-only.

## Arquitectura

```
  DISPOSITIVO DE CAMPO                          SERVIDOR
  ─────────────────────                         ─────────
  fe_ruta  /campo/*                             be_ruta (NestJS)
  SQLite local (@powersync/web)                  ├─ auth + token PowerSync
        │  ▲                                      ├─ JWKS (clave pública)
        │  │ lee/escribe local                    └─ endpoint de subida
        ▼  │                                              │ escribe
  ┌─────────────────┐   change streams (lee)   ┌──────────▼──────────┐
  │  PowerSync      │ ◄──────────────────────── │   MongoDB Atlas     │
  │  (ESTE stack)   │                           │   (fuente = be_ruta)│
  │  + Postgres     │   valida el JWT de be_ruta └─────────────────────┘
  │  (bucket store) │
  └─────────────────┘
```

- **Lectura:** PowerSync lee los cambios de Atlas por *change streams* y los baja
  al SQLite local según `sync-config.yaml`.
- **Escritura:** el cliente encola offline y, al reconectar, sube el batch a un
  endpoint de be_ruta que lo aplica a Atlas. PowerSync reintenta si falla.
- **Auth:** el cliente presenta un JWT emitido por be_ruta; PowerSync lo valida.

## Qué levanta este compose

| Servicio | Imagen | Rol |
|---|---|---|
| `powersync` | `journeyapps/powersync-service` | Motor de sync (API + replicación) |
| `bucket-storage` | `postgres:16` | Estado interno de PowerSync (**no** tus datos) |

La **fuente** (Atlas) y el **backend** (be_ruta) ya existen: no se levantan aquí,
se referencian por `.env`.

## Cómo correrlo

```bash
cd be_ruta/powersync
cp .env.example .env
# Edita .env: PS_MONGO_SOURCE_URI (= MONGODB_URI de be_ruta), PS_JWKS_URI, etc.
docker compose up -d
docker compose logs -f powersync   # verifica que replique y arranque la API
```

Requisitos: la fuente debe ser **replica set** (Atlas lo es ✓; change streams).

---

## Lo que falta para continuar

El stack queda **cableado**; esto es lo que sigue, en orden. Nada de esto está
hecho todavía.

### be_ruta (backend)
1. **Token PowerSync** — `GET /auth/powersync-token` (tras `JwtAuthGuard`) que
   devuelve un JWT con `{ sub: userId, aud: "powersync", exp: ~5min }`. Firmado
   HS256 con `JWT_SECRET` (arranque rápido) o RS256 (paso 2).
2. **JWKS (recomendado)** — par RS256 + `GET /auth/jwks` público con la clave
   pública. Cambia el token del paso 1 a RS256 y apunta `PS_JWKS_URI` aquí. Esto
   evita compartir el secreto simétrico con PowerSync.
3. **Endpoint de subida** — `POST /powersync/write` que recibe el batch de
   operaciones del cliente (`put`/`patch`/`delete` por colección) y las aplica a
   Mongo respetando permisos y el scope por unidad.
4. **Modelo `programa`** — crear las colecciones offline (`asistencia`,
   `progresion`, `diagnostico`) con **PK `_id` de una sola columna** (lo exige
   PowerSync) y `id_unidad` para el scope. Asegurar `id_unidad` en el roster.

### PowerSync (este stack)
5. Afinar `sync-config.yaml` con las colecciones/campos reales del paso 4.
6. **Fijar un tag** de imagen (no `:latest`) y confirmar contra ese tag el nombre
   del bloque (`sync_config` vs `sync_rules`) y el formato de reglas
   (`bucket_definitions` vs `streams` edición 3).

### fe_ruta (cliente)
7. Instalar **`@powersync/web`** y declarar el **esquema local** (las mismas
   tablas del sync).
8. `fetchCredentials()` → llama al endpoint del paso 1 y devuelve
   `{ endpoint, token }`.
9. `uploadData()` → envía las escrituras locales al endpoint del paso 3.
10. Segmento **client-first `/campo/*`** (NO SSR) que lee/escribe del SQLite local.
11. **Service Worker (Serwist)** para cachear el shell → la app carga offline.
12. **Auth offline** (lo decidido): sesión local **7 días + PIN/biométrico**,
    store cifrado, revocación al reconectar.

## Notas y advertencias

- `client_auth` viene wired al camino **RS256/JWKS** (recomendado). Para el
  arranque rápido HS256, descomenta el bloque `jwks:` en `service.yaml` y define
  `PS_JWT_SECRET_B64URL` — no recomendado para prod (secreto compartido).
- El bucket storage es **Postgres** (un nodo basta; soportado desde 2025). No
  guarda tus datos: solo checkpoints/buckets de PowerSync.
- Verifica el formato exacto de `service.yaml` y `sync-config.yaml` contra la
  versión que fijes: la config de PowerSync ha evolucionado entre versiones.

Referencias: [Local dev con Docker](https://docs.powersync.com/tools/local-development)
· [self-host-demo](https://github.com/powersync-ja/self-host-demo)
· [MongoDB como backend](https://releases.powersync.com/announcements/mongodb-as-a-backend-database-for-powersync-cloud)
