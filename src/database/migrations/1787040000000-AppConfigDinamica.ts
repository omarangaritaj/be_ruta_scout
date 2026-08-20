import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `siscout_config` (una fila, una columna por ajuste) pasa a `app_config` (una
 * fila por ajuste, con sus metadatos).
 *
 * El objetivo no es ahorrarse migraciones sino que el panel del frontend
 * descubra la configuración y la pinte sin programar un formulario por clave.
 * Por eso cada fila carga también su tipo, su etiqueta y sus límites.
 *
 * Los valores vigentes SE CONSERVAN: si una base ya tenía la configuración
 * ajustada a mano, el traspaso la respeta en lugar de devolverla a los valores
 * por defecto.
 */
export class AppConfigDinamica1787040000000 implements MigrationInterface {
  name = 'AppConfigDinamica1787040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "app_config" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "group" character varying NOT NULL,
        "key" character varying NOT NULL,
        "value" jsonb NOT NULL,
        "type" character varying NOT NULL,
        "constraints" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "label" character varying NOT NULL,
        "description" character varying,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isSystem" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_config" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_app_config_group_key" ON "app_config" ("group", "key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_app_config_group" ON "app_config" ("group")`,
    );

    // El traspaso solo tiene sentido si la tabla anterior existe: en una base
    // recién creada no hay nada que conservar y la siembra del arranque se
    // encarga de poblar el catálogo.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('siscout_config') IS NOT NULL THEN
          INSERT INTO "app_config"
            ("group", "key", "value", "type", "constraints", "label", "description", "sortOrder")
          SELECT * FROM (
            SELECT 'siscout', 'syncEnabled', to_jsonb(c."syncEnabled"), 'boolean',
                   '{}'::jsonb, 'Sincronización programada',
                   'Interruptor de la corrida automática.', 10 FROM "siscout_config" c
            UNION ALL
            SELECT 'siscout', 'syncCron', to_jsonb(c."syncCron"), 'cron',
                   '{}'::jsonb, 'Horario de la sincronización',
                   'Expresión cron. Por defecto, todos los días a las 3:00.', 20 FROM "siscout_config" c
            UNION ALL
            SELECT 'siscout', 'zoneIds', to_jsonb(c."zoneIds"), 'number[]',
                   '{"minItems":1,"min":1,"integer":true,"unique":true}'::jsonb, 'Zonas a descargar',
                   'Identificadores de zona. El 1 es Colombia entera.', 30 FROM "siscout_config" c
            UNION ALL
            SELECT 'siscout', 'pageLength', to_jsonb(c."pageLength"), 'number',
                   '{"min":1,"max":10000,"integer":true}'::jsonb, 'Tamaño de página',
                   'Registros por petición a SiScout.', 40 FROM "siscout_config" c
            UNION ALL
            SELECT 'siscout', 'maxPages', to_jsonb(c."maxPages"), 'number',
                   '{"min":1,"max":100,"integer":true}'::jsonb, 'Páginas máximas por zona',
                   'La capacidad de una zona es este número por el tamaño de página.', 50 FROM "siscout_config" c
            UNION ALL
            SELECT 'siscout', 'minMainZoneRecords', to_jsonb(c."minMainZoneRecords"), 'number',
                   '{"min":0,"integer":true}'::jsonb, 'Mínimo de la zona principal',
                   'Si la zona principal trae menos registros, la corrida se aborta.', 60 FROM "siscout_config" c
            UNION ALL
            SELECT 'siscout', 'writeChunkSize', to_jsonb(c."writeChunkSize"), 'number',
                   '{"min":1,"max":5000,"integer":true}'::jsonb, 'Tamaño del lote de escritura',
                   'Registros por lote al guardar en la base de datos.', 70 FROM "siscout_config" c
          ) AS traspaso
          ON CONFLICT ("group", "key") DO NOTHING;
        END IF;
      END $$;
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "siscout_config"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "siscout_config" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying NOT NULL DEFAULT 'default',
        "zoneIds" integer array NOT NULL DEFAULT '{1}',
        "pageLength" integer NOT NULL DEFAULT '4000',
        "maxPages" integer NOT NULL DEFAULT '3',
        "minMainZoneRecords" integer NOT NULL DEFAULT '1000',
        "writeChunkSize" integer NOT NULL DEFAULT '500',
        "syncCron" character varying NOT NULL DEFAULT '0 3 * * *',
        "syncEnabled" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_5073d5eadbceb2ccda7fa445db3" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_52247a49bbaeccf559694f4994" ON "siscout_config" ("key")`,
    );

    // Devuelve los valores del grupo `siscout` a las columnas de las que
    // salieron. Las claves que se hayan añadido en caliente no tienen columna
    // donde volver: se pierden, y por eso este `down` es de emergencia.
    await queryRunner.query(`
      INSERT INTO "siscout_config"
        ("key", "zoneIds", "pageLength", "maxPages", "minMainZoneRecords", "writeChunkSize", "syncCron", "syncEnabled")
      SELECT
        'default',
        COALESCE((SELECT ARRAY(SELECT jsonb_array_elements_text(value)::int) FROM "app_config" WHERE "group" = 'siscout' AND "key" = 'zoneIds'), '{1}'),
        COALESCE((SELECT (value #>> '{}')::int FROM "app_config" WHERE "group" = 'siscout' AND "key" = 'pageLength'), 4000),
        COALESCE((SELECT (value #>> '{}')::int FROM "app_config" WHERE "group" = 'siscout' AND "key" = 'maxPages'), 3),
        COALESCE((SELECT (value #>> '{}')::int FROM "app_config" WHERE "group" = 'siscout' AND "key" = 'minMainZoneRecords'), 1000),
        COALESCE((SELECT (value #>> '{}')::int FROM "app_config" WHERE "group" = 'siscout' AND "key" = 'writeChunkSize'), 500),
        COALESCE((SELECT value #>> '{}' FROM "app_config" WHERE "group" = 'siscout' AND "key" = 'syncCron'), '0 3 * * *'),
        COALESCE((SELECT (value #>> '{}')::boolean FROM "app_config" WHERE "group" = 'siscout' AND "key" = 'syncEnabled'), false)
    `);

    await queryRunner.query(`DROP INDEX "ruta"."IDX_app_config_group"`);
    await queryRunner.query(`DROP INDEX "ruta"."IDX_app_config_group_key"`);
    await queryRunner.query(`DROP TABLE "app_config"`);
  }
}
