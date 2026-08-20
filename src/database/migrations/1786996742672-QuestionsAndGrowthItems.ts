import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuestionsAndGrowthItems1786996742672 implements MigrationInterface {
  name = 'QuestionsAndGrowthItems1786996742672';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "ruta"."branch" AS ENUM('familia', 'manada', 'tropa', 'comunidad', 'clan')`,
    );
    await queryRunner.query(
      `CREATE TYPE "ruta"."diagnostic_block" AS ENUM('rap', 'gsat', 'metodo_scout', 'duraslid')`,
    );
    await queryRunner.query(
      `CREATE TABLE "questions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch" "ruta"."branch" NOT NULL, "block" "ruta"."diagnostic_block" NOT NULL, "text" character varying NOT NULL, "order" integer NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_08a6d4b0f49ff300bf3a0ca60ac" PRIMARY KEY ("id"))`,
    );
    // El tipo "branch" ya se creó arriba: questions y growth_items lo comparten
    // (enumName común), pero el generador emite un CREATE TYPE por entidad.
    await queryRunner.query(
      `CREATE TYPE "ruta"."growth_area" AS ENUM('corporalidad', 'creatividad', 'caracter', 'afectividad', 'sociabilidad', 'espiritualidad', 'socioafectividad')`,
    );
    await queryRunner.query(
      `CREATE TABLE "growth_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch" "ruta"."branch" NOT NULL, "growthArea" "ruta"."growth_area" NOT NULL, "text" character varying NOT NULL, "order" integer NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_953d2442d64296cacd7ed085560" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6db25223b8e82992535a6f6773" ON "growth_items" ("branch", "growthArea", "order") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_6db25223b8e82992535a6f6773"`,
    );
    await queryRunner.query(`DROP TABLE "growth_items"`);
    await queryRunner.query(`DROP TYPE "ruta"."growth_area"`);
    await queryRunner.query(`DROP TABLE "questions"`);
    await queryRunner.query(`DROP TYPE "ruta"."diagnostic_block"`);
    await queryRunner.query(`DROP TYPE "ruta"."branch"`);
  }
}
