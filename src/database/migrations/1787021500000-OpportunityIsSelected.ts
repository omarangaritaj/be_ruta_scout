import { MigrationInterface, QueryRunner } from 'typeorm';

export class OpportunityIsSelected1787021500000 implements MigrationInterface {
  name = 'OpportunityIsSelected1787021500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "learning_opportunities" ADD "isSelected" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "learning_opportunities" DROP COLUMN "isSelected"`,
    );
  }
}
