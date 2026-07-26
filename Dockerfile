# syntax=docker/dockerfile:1

# ───────────────── base ─────────────────
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

# ───────────────── deps (dev + prod, se cachea mientras no cambie el lockfile) ─────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ───────────────── prod-deps (solo prod, se cachea mientras no cambie el lockfile) ─────────────────
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# ───────────────── build (única etapa que se re-ejecuta al cambiar código) ─────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# El gate va aquí y no en un runner de CI: así ninguna imagen desplegable puede
# existir sin haber pasado tipos, lint, tests y el guard del catálogo i18n, se
# construya donde se construya. `verify` usa `lint:check` (sin --fix), porque un
# lint que corrige en vez de fallar no es un gate.
RUN pnpm verify
RUN pnpm build

# ───────────────── production ─────────────────
FROM node:24-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./package.json
# La imagen de Node trae el usuario `node` sin privilegios: la aplicación
# maneja datos de menores bajo Ley 1581 y no hay razón para que corra como root.
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
