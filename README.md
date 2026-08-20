# be_ruta (v2)

Backend NestJS de **Ruta v2**: API REST + socket.io sobre **PostgreSQL**.

Reconstrucción del backend de `work-around-ruta/be_ruta` eliminando MongoDB y
PowerSync. El navegador (PWA client-only) consume esta API directamente.

## Stack

| Pieza | Elección | Nota |
| --- | --- | --- |
| Framework | NestJS 11 | Igual que el sistema anterior |
| Base de datos | PostgreSQL 16 + TypeORM | Reemplaza Mongoose/MongoDB. Esquema por migraciones, `synchronize: false` |
| Postgres remoto | Supabase (`SUPABASE_DATABASE_URL`) | Conexión declarada y opcional |
| Tiempo real | socket.io (`@nestjs/platform-socket.io`) | Reemplaza la sincronización PowerSync |
| Cache | Redis (ioredis) | Igual que antes: degrada con gracia si no responde |
| Auth | JWT access + refresh opaco (Passport) | Mismo modelo del sistema anterior |
| Correo | Resend + React Email | Igual que antes |

## Desarrollo

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres + Redis locales
cp .env.example .env                              # completar JWT_SECRET
pnpm install
pnpm start:dev
```

Verificación completa: `pnpm verify` (typecheck + lint + tests).

Migraciones: `pnpm migration:generate src/database/migrations/<Nombre>`,
`pnpm migration:run`, `pnpm migration:revert`.

## Estado y hoja de ruta

El inventario completo de módulos del sistema anterior, con su orden de
migración sugerido y qué cambia en cada uno, está en **[INVENTARIO.md](INVENTARIO.md)**.
