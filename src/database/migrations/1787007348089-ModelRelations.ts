import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModelRelations1787007348089 implements MigrationInterface {
  name = 'ModelRelations1787007348089';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_573707d34e5b3252f03b728b3f5" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "solicitudes_acceso" ADD CONSTRAINT "FK_4ffca410bf3de13b32ffbdb856b" FOREIGN KEY ("aprobadoPor") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "solicitudes_acceso" DROP CONSTRAINT "FK_4ffca410bf3de13b32ffbdb856b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_573707d34e5b3252f03b728b3f5"`,
    );
  }
}
