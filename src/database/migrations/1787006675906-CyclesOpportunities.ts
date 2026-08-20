import { MigrationInterface, QueryRunner } from 'typeorm';

export class CyclesOpportunities1787006675906 implements MigrationInterface {
  name = 'CyclesOpportunities1787006675906';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "cycles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "unitId" uuid NOT NULL, "name" character varying NOT NULL, "startDate" TIMESTAMP WITH TIME ZONE NOT NULL, "endDate" TIMESTAMP WITH TIME ZONE NOT NULL, "diagnosticAnswers" jsonb NOT NULL DEFAULT '[]', "diagnosticSummary" character varying, "focus" jsonb NOT NULL DEFAULT '{}', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_52e5eeb9c7c6e4ad1aed657967a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ff2ef7b564f14c05a2eba7aeb2" ON "cycles" ("unitId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "ruta"."opportunity_audience" AS ENUM('unidad_completa', 'subgrupo', 'protagonistas_especificos')`,
    );
    await queryRunner.query(
      `CREATE TABLE "learning_opportunities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cycleId" uuid NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL, "protagonistVoice" character varying NOT NULL, "competency" jsonb NOT NULL, "audience" "ruta"."opportunity_audience" NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4f6984a232c79c4b8a80875b048" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fed4cab5b1bb21f381c63e1da7" ON "learning_opportunities" ("cycleId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" ADD CONSTRAINT "FK_ff2ef7b564f14c05a2eba7aeb2d" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "learning_opportunities" ADD CONSTRAINT "FK_fed4cab5b1bb21f381c63e1da7c" FOREIGN KEY ("cycleId") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "learning_opportunities" DROP CONSTRAINT "FK_fed4cab5b1bb21f381c63e1da7c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" DROP CONSTRAINT "FK_ff2ef7b564f14c05a2eba7aeb2d"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_fed4cab5b1bb21f381c63e1da7"`,
    );
    await queryRunner.query(`DROP TABLE "learning_opportunities"`);
    await queryRunner.query(`DROP TYPE "ruta"."opportunity_audience"`);
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_ff2ef7b564f14c05a2eba7aeb2"`,
    );
    await queryRunner.query(`DROP TABLE "cycles"`);
  }
}
