import 'dotenv/config';
import { Client } from 'pg';

/**
 * Falla si algún objeto del esquema aterrizó en `public`.
 *
 * Este guard existe por un modo de fallo real y silencioso: el SQL escrito a
 * mano dentro de las migraciones (`CREATE TABLE "users"`) no lleva schema, así
 * que lo resuelve el `search_path` del servidor. Si alguien quita
 * `extra.options` de `data-source.ts`, o corre las migraciones con otra
 * herramienta, las tablas se crean en `public` y TODO SIGUE FUNCIONANDO — solo
 * que en Supabase quedan publicadas por PostgREST con la anon key.
 *
 * Un fallo que no rompe nada visible es el que llega a producción. Por eso se
 * verifica explícitamente.
 *
 * Uso: pnpm db:check-schema
 */
const SCHEMA = 'ruta';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no está definida. Revisa el .env');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows: intrusas } = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    const { rows: propias } = await client.query<{ total: string }>(
      'SELECT count(*)::text AS total FROM pg_tables WHERE schemaname = $1',
      [SCHEMA],
    );

    console.log(`Tablas en "${SCHEMA}": ${propias[0]?.total ?? 0}`);

    if (intrusas.length > 0) {
      console.error(
        `\n✖ Hay ${intrusas.length} tabla(s) en "public":\n  ` +
          intrusas.map((fila) => fila.tablename).join('\n  ') +
          '\n\nEn Supabase, "public" lo publica PostgREST con la anon key. ' +
          `Revisa el search_path de la conexión: debe empezar por "${SCHEMA}".`,
      );
      process.exit(1);
    }

    console.log('✔ "public" está limpio.');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('No se pudo verificar el schema:', error);
  process.exit(1);
});
