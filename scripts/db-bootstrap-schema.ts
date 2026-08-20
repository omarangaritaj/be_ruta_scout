import 'dotenv/config';
import { Client } from 'pg';

/**
 * Crea el schema de la aplicación si no existe.
 *
 * Por qué existe este script: TypeORM crea su tabla `migrations` DENTRO del
 * schema configurado, pero `MigrationExecutor` nunca ejecuta `CREATE SCHEMA`.
 * Si el schema no existe, la primera migración falla con
 * «schema "ruta" does not exist». Por eso `pnpm migration:run` lo encadena
 * antes: correr migraciones contra una base virgen debe funcionar sin pasos
 * manuales, tanto en el Postgres local como en Supabase.
 *
 * El schema es deliberadamente distinto de `public`: en Supabase, `public` lo
 * publica PostgREST con la anon key y hereda `ALTER DEFAULT PRIVILEGES ...
 * GRANT ALL ON TABLES TO anon`. Ver `src/database/database.module.ts`.
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
    // Identificador fijo (no viene de entrada externa), pero se cita igual para
    // que el schema se cree tal cual y no en minúsculas por plegado.
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
    const { rows } = await client.query<{ existe: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS existe',
      [SCHEMA],
    );
    if (!rows[0]?.existe) {
      throw new Error(`el schema "${SCHEMA}" no quedó creado`);
    }
    console.log(`Schema "${SCHEMA}" listo.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('No se pudo preparar el schema:', error);
  process.exit(1);
});
