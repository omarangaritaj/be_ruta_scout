import { MigrationInterface, QueryRunner } from 'typeorm';

export class CycleActivation1787022400000 implements MigrationInterface {
  name = 'CycleActivation1787022400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cycles" ADD "activatedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cycles" DROP COLUMN "activatedAt"`);
  }
}
