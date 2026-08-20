import { MigrationInterface, QueryRunner } from 'typeorm';

export class SolicitudesNotificacionesSiscout1786998329489 implements MigrationInterface {
  name = 'SolicitudesNotificacionesSiscout1786998329489';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "ruta"."nivel_solicitud" AS ENUM('rama', 'grupo', 'region', 'nacion')`,
    );
    await queryRunner.query(
      `CREATE TYPE "ruta"."rama" AS ENUM('familia', 'manada', 'tropa', 'comunidad', 'clan')`,
    );
    await queryRunner.query(
      `CREATE TYPE "ruta"."estado_solicitud" AS ENUM('pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada')`,
    );
    await queryRunner.query(
      `CREATE TABLE "solicitudes_acceso" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "idPersona" uuid NOT NULL, "nivelSolicitado" "ruta"."nivel_solicitud" NOT NULL, "cargoSolicitado" character varying NOT NULL, "telefonoContacto" character varying NOT NULL, "rama" "ruta"."rama", "groupId" integer, "districtId" integer, "estado" "ruta"."estado_solicitud" NOT NULL DEFAULT 'pendiente', "aprobadoPor" uuid, "nivelAprobado" "ruta"."nivel_solicitud", "cargoAprobado" character varying, "notaAprobador" character varying, "resueltoEn" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7f8d89d4127858ef96940d57d78" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2d40f37ca6c28e1673c077925a" ON "solicitudes_acceso" ("estado") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_solicitud_pendiente_por_persona" ON "solicitudes_acceso" ("idPersona") WHERE "estado" = 'pendiente'`,
    );
    await queryRunner.query(
      `CREATE TABLE "siscout_snapshots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "idSiscout" character varying NOT NULL, "hash" character varying NOT NULL, "payload" jsonb NOT NULL, "sincronizadoEn" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_15fa3ef25a2decad65bbc28e32b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_18dd89c8172cd961b538ba6385" ON "siscout_snapshots" ("idSiscout") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_15ee5f06d023ab7b9907971a05" ON "siscout_snapshots" ("hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "siscout_credentials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying NOT NULL, "descripcion" character varying, "usuario" character varying NOT NULL, "password" jsonb NOT NULL, "changeRolPath" character varying NOT NULL, "alcance" jsonb NOT NULL, "prioridad" integer NOT NULL DEFAULT '100', "activa" boolean NOT NULL DEFAULT true, "ultimoUsoEn" TIMESTAMP WITH TIME ZONE, "ultimoErrorEn" TIMESTAMP WITH TIME ZONE, "ultimoError" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7299989c1f22847aa3e8af13e6f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_23a1746ad8ecfec128a83e8d1b" ON "siscout_credentials" ("nombre") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ba4d2440a36f75270ad59482b" ON "siscout_credentials" ("activa", "prioridad") `,
    );
    await queryRunner.query(
      `CREATE TABLE "siscout_config" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying NOT NULL DEFAULT 'default', "zoneIds" integer array NOT NULL DEFAULT '{1}', "pageLength" integer NOT NULL DEFAULT '4000', "maxPages" integer NOT NULL DEFAULT '3', "minMainZoneRecords" integer NOT NULL DEFAULT '1000', "writeChunkSize" integer NOT NULL DEFAULT '500', "syncCron" character varying NOT NULL DEFAULT '0 3 * * *', "syncEnabled" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5073d5eadbceb2ccda7fa445db3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_52247a49bbaeccf559694f4994" ON "siscout_config" ("key") `,
    );
    await queryRunner.query(
      `CREATE TYPE "ruta"."estado_notificacion" AS ENUM('pendiente', 'enviada', 'fallida')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notificaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipo" character varying NOT NULL, "destinatario" jsonb NOT NULL DEFAULT '{}', "datos" jsonb NOT NULL DEFAULT '{}', "estado" "ruta"."estado_notificacion" NOT NULL DEFAULT 'pendiente', "enviadoEn" TIMESTAMP WITH TIME ZONE, "error" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a9d32a419ff58b53a38b5ef85d4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_761cbc762860a1616f9067f0c4" ON "notificaciones" ("tipo") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e1fc5e910fca3d7ed1daae7c97" ON "notificaciones" ("estado") `,
    );
    await queryRunner.query(
      `ALTER TABLE "solicitudes_acceso" ADD CONSTRAINT "FK_97e7cab1c5c476322212f40cc4a" FOREIGN KEY ("idPersona") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "solicitudes_acceso" DROP CONSTRAINT "FK_97e7cab1c5c476322212f40cc4a"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_e1fc5e910fca3d7ed1daae7c97"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_761cbc762860a1616f9067f0c4"`,
    );
    await queryRunner.query(`DROP TABLE "notificaciones"`);
    await queryRunner.query(`DROP TYPE "ruta"."estado_notificacion"`);
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_52247a49bbaeccf559694f4994"`,
    );
    await queryRunner.query(`DROP TABLE "siscout_config"`);
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_1ba4d2440a36f75270ad59482b"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_23a1746ad8ecfec128a83e8d1b"`,
    );
    await queryRunner.query(`DROP TABLE "siscout_credentials"`);
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_15ee5f06d023ab7b9907971a05"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_18dd89c8172cd961b538ba6385"`,
    );
    await queryRunner.query(`DROP TABLE "siscout_snapshots"`);
    await queryRunner.query(
      `DROP INDEX "ruta"."UQ_solicitud_pendiente_por_persona"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_2d40f37ca6c28e1673c077925a"`,
    );
    await queryRunner.query(`DROP TABLE "solicitudes_acceso"`);
    await queryRunner.query(`DROP TYPE "ruta"."estado_solicitud"`);
    await queryRunner.query(`DROP TYPE "ruta"."rama"`);
    await queryRunner.query(`DROP TYPE "ruta"."nivel_solicitud"`);
  }
}
