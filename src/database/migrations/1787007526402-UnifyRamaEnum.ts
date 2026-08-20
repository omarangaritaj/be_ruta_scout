import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unifica el enum `rama` con `branch`: `RAMAS` es un alias de `BRANCHES`, así
 * que la base tenía dos tipos idénticos.
 *
 * El SQL va escrito a mano porque el generador emite `CREATE TYPE "branch"`
 * (compara la columna de forma aislada y no ve que ese tipo ya existe, usado
 * por questions, growth_items, units y cycles). Aquí solo se reapunta la
 * columna al tipo vigente y se retira el duplicado.
 */
export class UnifyRamaEnum1787007526402 implements MigrationInterface {
  name = 'UnifyRamaEnum1787007526402';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "solicitudes_acceso" ALTER COLUMN "rama" TYPE "ruta"."branch" USING "rama"::"text"::"ruta"."branch"`,
    );
    await queryRunner.query(`DROP TYPE "ruta"."rama"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "ruta"."rama" AS ENUM('familia', 'manada', 'tropa', 'comunidad', 'clan')`,
    );
    await queryRunner.query(
      `ALTER TABLE "solicitudes_acceso" ALTER COLUMN "rama" TYPE "ruta"."rama" USING "rama"::"text"::"ruta"."rama"`,
    );
  }
}
