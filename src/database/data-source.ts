import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource para la CLI de TypeORM (generar/correr/revertir migraciones).
 *
 * La aplicación NO usa este archivo: en runtime la conexión la arma
 * `DatabaseModule` a partir del entorno validado. Aquí se lee `process.env`
 * directamente porque la CLI corre fuera del contenedor de NestJS.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // Debe coincidir con el `schema` de `DatabaseModule`: si la CLI escribiera en
  // otro schema, la tabla `migrations` se duplicaría y el historial divergiría.
  schema: 'ruta',
  // `schema` solo califica lo que TypeORM genera (entidades y tabla
  // `migrations`); el SQL escrito a mano dentro de las migraciones dice
  // `CREATE TABLE "users"` sin schema y lo resuelve el search_path del servidor.
  // El default es `"$user", public`, así que sin esto las migraciones crearían
  // las tablas en `public` — justo lo que este diseño evita. Ojo: en el Postgres
  // local NO se nota, porque el usuario se llama `ruta` y `"$user"` acierta por
  // casualidad; en Supabase el usuario es `postgres` y caería en `public`.
  // Va en `extra` (parámetro de arranque de libpq) y no como `SET`, para que
  // aplique desde la primera sentencia. Por eso las migraciones se corren por
  // conexión directa o session pooler, nunca por el transaction pooler.
  // `ruta` va PRIMERO: `CREATE TABLE` sin calificar usa el primer schema del
  // path, así que todo el esquema aterriza ahí. `extensions` y `public` van
  // detrás solo para RESOLVER funciones: las migraciones llaman
  // `uuid_generate_v4()`, que en Supabase vive en `extensions` y en un Postgres
  // corriente en `public`. Sin ellos, las 13 migraciones fallan.
  extra: { options: '-c search_path=ruta,extensions,public' },
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
