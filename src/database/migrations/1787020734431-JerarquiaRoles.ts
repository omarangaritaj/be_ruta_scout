import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Jerarquía de roles: cada rol cuelga de otro y arrastra su linaje.
 *
 * Responde una pregunta que la contención de permisos no responde: no "¿puedo
 * respaldar este poder?" sino "¿este rol es mío para gestionarlo?". Sin árbol,
 * cualquiera con `role:update` que casualmente contenga los permisos de un rol
 * podía editarlo o borrarlo, aunque lo hubiera creado un par de otra área.
 *
 * Backfill: `super_admin` (el rol del sistema) queda como raíz y todo lo demás
 * cuelga de él. Así el super admin conserva alcance sobre todo el árbol y
 * ningún rol existente queda huérfano —un rol sin linaje no lo podría gestionar
 * nadie—.
 */
export class JerarquiaRoles1787020734431 implements MigrationInterface {
  name = 'JerarquiaRoles1787020734431';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "roles" ADD "parentId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "roles" ADD "nivel" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ADD "ancestros" uuid array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_633896956090cdd56c930423f6" ON "roles" ("parentId") `,
    );
    // GIN y no el btree que genera TypeORM: sobre `ancestros` se pregunta por
    // CONTENCIÓN (`@> ARRAY[...]`, "¿está este rol bajo el mío?"), y un btree
    // sobre un arreglo solo sirve para comparar el arreglo entero.
    await queryRunner.query(
      `CREATE INDEX "IDX_2f0ae80926ba77291d55b8daf2" ON "roles" USING GIN ("ancestros")`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "FK_633896956090cdd56c930423f6d" FOREIGN KEY ("parentId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // Si no hubiera rol de sistema, el FROM no da filas y no se toca nada:
    // mejor todos raíz que colgados de un padre inventado.
    await queryRunner.query(`
      UPDATE "roles" r
      SET "parentId" = raiz.id, "nivel" = 1, "ancestros" = ARRAY[raiz.id]
      FROM (
        SELECT id FROM "roles" WHERE "esSistema" = true ORDER BY "createdAt" LIMIT 1
      ) AS raiz
      WHERE r."esSistema" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roles" DROP CONSTRAINT "FK_633896956090cdd56c930423f6d"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_2f0ae80926ba77291d55b8daf2"`,
    );
    await queryRunner.query(
      `DROP INDEX "ruta"."IDX_633896956090cdd56c930423f6"`,
    );
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "ancestros"`);
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "nivel"`);
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "parentId"`);
  }
}
