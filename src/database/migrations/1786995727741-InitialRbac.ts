import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialRbac1786995727741 implements MigrationInterface {
  name = 'InitialRbac1786995727741';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "ruta"."estado_role" AS ENUM('activo', 'inactivo')`,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying NOT NULL, "descripcion" character varying, "permissions" text array NOT NULL DEFAULT '{}', "resources" text array NOT NULL DEFAULT '{}', "status" "ruta"."estado_role" NOT NULL DEFAULT 'activo', "esSistema" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a5be7aa67e759e347b1c6464e1" ON "roles" ("nombre") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_14958a120176d4e1e8be423977" ON "roles" ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "ruta"."tipo_persona" AS ENUM('adulto', 'protagonista')`,
    );
    await queryRunner.query(
      `CREATE TYPE "ruta"."estado_acceso" AS ENUM('sin_solicitud', 'pendiente', 'aprobado', 'rechazado', 'suspendido')`,
    );
    await queryRunner.query(
      `CREATE TYPE "ruta"."nivel_acceso" AS ENUM('rama', 'grupo', 'region', 'nacion', 'super_admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "tipo" "ruta"."tipo_persona" NOT NULL, "idSiscout" character varying NOT NULL, "cedulaHash" character varying, "passwordHash" character varying, "estado" boolean NOT NULL DEFAULT true, "estadoAcceso" "ruta"."estado_acceso" NOT NULL DEFAULT 'sin_solicitud', "nivelAcceso" "ruta"."nivel_acceso", "districtId" integer, "districtName" character varying, "groupId" integer, "groupName" character varying, "cargoSiscout" character varying, "age" integer, "cargos" jsonb NOT NULL DEFAULT '[]', "estadoSiscout" boolean NOT NULL DEFAULT true, "sincronizadoEn" TIMESTAMP WITH TIME ZONE, "ultimoSyncId" character varying, "fechaBajaSiscout" TIMESTAMP WITH TIME ZONE, "unitId" uuid, "idSubgrupo" uuid, "nombrePreferido" character varying, "fechaNacimiento" TIMESTAMP WITH TIME ZONE, "fechaIngreso" TIMESTAMP WITH TIME ZONE, "acudiente" jsonb, "apoyos" character varying, "promesaRealizada" boolean, "promesaFecha" TIMESTAMP WITH TIME ZONE, "enTransicion" boolean, "transicionObservaciones" character varying, "observaciones" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_00de6a406ec552a0ca4fe831fd" ON "users" ("tipo") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_13826bfe2142fcb82e7291bbaf" ON "users" ("idSiscout") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5a1f37a109f4895f6b7cdcfcbc" ON "users" ("cedulaHash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ecb4637b1a03e6463e0f1fc9a8" ON "users" ("estado") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3f7632145ce3997683fb7dbd66" ON "users" ("estadoAcceso") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dd0b12a0e1003e7968b756f371" ON "users" ("districtId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b1d770f014b76f7cfb58089daf" ON "users" ("groupId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_31225e5579e2b5b8a3e7c97a70" ON "users" ("estadoSiscout") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8c4e86396f126159e4c8c8f392" ON "users" ("ultimoSyncId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tokenHash" character varying NOT NULL, "userId" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c25bc63d248ca90e8dcc1d92d0" ON "refresh_tokens" ("tokenHash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON "refresh_tokens" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_56b91d98f71e3d1b649ed6e9f3" ON "refresh_tokens" ("expiresAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_roles" ("user_id" uuid NOT NULL, "role_id" uuid NOT NULL, CONSTRAINT "PK_23ed6f04fe43066df08379fd034" PRIMARY KEY ("user_id", "role_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_87b8888186ca9769c960e92687" ON "user_roles" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b23c65e50a758245a33ee35fda" ON "user_roles" ("role_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_b23c65e50a758245a33ee35fda"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_87b8888186ca9769c960e92687"`,
    );
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_56b91d98f71e3d1b649ed6e9f3"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_610102b60fea1455310ccd299d"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_c25bc63d248ca90e8dcc1d92d0"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_8c4e86396f126159e4c8c8f392"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_31225e5579e2b5b8a3e7c97a70"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_b1d770f014b76f7cfb58089daf"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_dd0b12a0e1003e7968b756f371"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_3f7632145ce3997683fb7dbd66"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_ecb4637b1a03e6463e0f1fc9a8"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_5a1f37a109f4895f6b7cdcfcbc"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_13826bfe2142fcb82e7291bbaf"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_00de6a406ec552a0ca4fe831fd"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "ruta"."nivel_acceso"`);
    await queryRunner.query(`DROP TYPE "ruta"."estado_acceso"`);
    await queryRunner.query(`DROP TYPE "ruta"."tipo_persona"`);
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_14958a120176d4e1e8be423977"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_a5be7aa67e759e347b1c6464e1"`,
    );
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TYPE "ruta"."estado_role"`);
  }
}
