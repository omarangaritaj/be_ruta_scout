import { MigrationInterface, QueryRunner } from 'typeorm';

export class Units1787004484600 implements MigrationInterface {
  name = 'Units1787004484600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "units" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "branch" "ruta"."branch" NOT NULL, "groupId" integer NOT NULL, "districtId" integer, "districtName" character varying, "city" character varying, "leaderId" uuid NOT NULL, "configuredAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5a8f2f064919b587d93936cb223" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_180fb0b6aa5bd2577ffca125ad" ON "units" ("branch") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c57a44fbcb44bfe616095760d4" ON "units" ("groupId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6fbf81a7b5f797543cfc24def2" ON "units" ("districtId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6b1cb732998445af76549d47b9" ON "units" ("groupId", "name") `,
    );
    await queryRunner.query(
      `CREATE TYPE "ruta"."unit_role" AS ENUM('unit_leader', 'assistant', 'member')`,
    );
    await queryRunner.query(
      `CREATE TABLE "unit_memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "unitId" uuid NOT NULL, "role" "ruta"."unit_role" NOT NULL, "groupId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f3f38ce89193fa60c98105bad40" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5c620b3460bce6ed32a1b415a5" ON "unit_memberships" ("groupId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_059c89183a21fb8296cd77e5c9" ON "unit_memberships" ("unitId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9caed5dde3dab0b248e9899fb1" ON "unit_memberships" ("userId", "unitId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "unit_leaders" ("unit_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_0f897d175bebdfc8aaf827c8e76" PRIMARY KEY ("unit_id", "user_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d5ac4d98d864bc24c03a638548" ON "unit_leaders" ("unit_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_67175585c72d1b7cd4803ea6bc" ON "unit_leaders" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "unit_members" ("unit_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_5d2b7e02e2507d995f94e5e44ac" PRIMARY KEY ("unit_id", "user_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_facf1771055919e25bd8d0ba8a" ON "unit_members" ("unit_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7e2cc88473b764f2a51b1ecfa8" ON "unit_members" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "units" ADD CONSTRAINT "FK_b9a5d56322dfc5d6ec4c001ecd9" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "unit_memberships" ADD CONSTRAINT "FK_e796b5d994d8f3464d88a86f0ad" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "unit_memberships" ADD CONSTRAINT "FK_059c89183a21fb8296cd77e5c95" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "unit_leaders" ADD CONSTRAINT "FK_d5ac4d98d864bc24c03a6385488" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "unit_leaders" ADD CONSTRAINT "FK_67175585c72d1b7cd4803ea6bcd" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "unit_members" ADD CONSTRAINT "FK_facf1771055919e25bd8d0ba8ad" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "unit_members" ADD CONSTRAINT "FK_7e2cc88473b764f2a51b1ecfa8d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "unit_members" DROP CONSTRAINT "FK_7e2cc88473b764f2a51b1ecfa8d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "unit_members" DROP CONSTRAINT "FK_facf1771055919e25bd8d0ba8ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "unit_leaders" DROP CONSTRAINT "FK_67175585c72d1b7cd4803ea6bcd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "unit_leaders" DROP CONSTRAINT "FK_d5ac4d98d864bc24c03a6385488"`,
    );
    await queryRunner.query(
      `ALTER TABLE "unit_memberships" DROP CONSTRAINT "FK_059c89183a21fb8296cd77e5c95"`,
    );
    await queryRunner.query(
      `ALTER TABLE "unit_memberships" DROP CONSTRAINT "FK_e796b5d994d8f3464d88a86f0ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "units" DROP CONSTRAINT "FK_b9a5d56322dfc5d6ec4c001ecd9"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_7e2cc88473b764f2a51b1ecfa8"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_facf1771055919e25bd8d0ba8a"`,
    );
    await queryRunner.query(`DROP TABLE "unit_members"`);
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_67175585c72d1b7cd4803ea6bc"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_d5ac4d98d864bc24c03a638548"`,
    );
    await queryRunner.query(`DROP TABLE "unit_leaders"`);
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_9caed5dde3dab0b248e9899fb1"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_059c89183a21fb8296cd77e5c9"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_5c620b3460bce6ed32a1b415a5"`,
    );
    await queryRunner.query(`DROP TABLE "unit_memberships"`);
    await queryRunner.query(`DROP TYPE "ruta"."unit_role"`);
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_6b1cb732998445af76549d47b9"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_6fbf81a7b5f797543cfc24def2"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_c57a44fbcb44bfe616095760d4"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_180fb0b6aa5bd2577ffca125ad"`,
    );
    await queryRunner.query(`DROP TABLE "units"`);
  }
}
