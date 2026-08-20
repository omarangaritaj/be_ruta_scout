import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProgramEvents1787030000000 implements MigrationInterface {
  name = 'ProgramEvents1787030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "ruta"."program_event_kind" AS ENUM('reunion', 'actividad')`,
    );

    await queryRunner.query(`
      CREATE TABLE "program_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "unitId" uuid NOT NULL,
        "cycleId" uuid,
        "kind" "ruta"."program_event_kind" NOT NULL,
        "scope" character varying NOT NULL,
        "name" character varying NOT NULL,
        "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "startTime" TIME,
        "endTime" TIME,
        "place" character varying NOT NULL,
        "responsibleUserId" uuid,
        "safeguarding" jsonb NOT NULL,
        "online" jsonb,
        "agenda" jsonb NOT NULL DEFAULT '[]',
        "riskManagement" jsonb NOT NULL DEFAULT '{"checks": [], "risks": []}',
        "adultTeam" jsonb NOT NULL DEFAULT '[]',
        "materials" jsonb NOT NULL DEFAULT '[]',
        "participatingUnitIds" jsonb NOT NULL DEFAULT '[]',
        "evaluation" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_program_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "program_events"
        ADD CONSTRAINT "FK_program_events_unit"
        FOREIGN KEY ("unitId") REFERENCES "units"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "program_events"
        ADD CONSTRAINT "FK_program_events_cycle"
        FOREIGN KEY ("cycleId") REFERENCES "cycles"("id")
        ON DELETE SET NULL
    `);

    // El responsable puede irse de la unidad sin que se borre la reunión que
    // planeó: el evento sobrevive y pierde su responsable, igual que en
    // `FK_program_events_cycle`.
    await queryRunner.query(`
      ALTER TABLE "program_events"
        ADD CONSTRAINT "FK_program_events_responsible"
        FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id")
        ON DELETE SET NULL
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_program_events_unit" ON "program_events" ("unitId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_program_events_cycle" ON "program_events" ("cycleId")`,
    );

    // Regla 3: una sola reunión por unidad y fecha. La regla vive acá, no en
    // un `if` del servicio, para que ninguna carrera la esquive.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UX_program_events_reunion_fecha"
        ON "program_events" ("unitId", "startDate")
        WHERE "kind" = 'reunion' AND "isActive"
    `);

    await queryRunner.query(`
      CREATE TABLE "program_event_opportunities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "programEventId" uuid NOT NULL,
        "learningOpportunityId" uuid NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "plan" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_program_event_opportunities" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_program_event_opportunity"
          UNIQUE ("programEventId", "learningOpportunityId")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "program_event_opportunities"
        ADD CONSTRAINT "FK_peo_event"
        FOREIGN KEY ("programEventId") REFERENCES "program_events"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "program_event_opportunities"
        ADD CONSTRAINT "FK_peo_opportunity"
        FOREIGN KEY ("learningOpportunityId")
        REFERENCES "learning_opportunities"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_peo_event" ON "program_event_opportunities" ("programEventId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_peo_opportunity" ON "program_event_opportunities" ("learningOpportunityId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "program_event_opportunities"`);
    await queryRunner.query(`DROP INDEX "UX_program_events_reunion_fecha"`);
    await queryRunner.query(`DROP TABLE "program_events"`);
    await queryRunner.query(`DROP TYPE "ruta"."program_event_kind"`);
  }
}
