import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `focus` nace con `competencies: []`.
 *
 * El sistema anterior declaraba el subdocumento con `default: []`, así que
 * Mongoose materializaba el arreglo en cada respuesta y el frontend lo recorre
 * sin comprobar. Al pasar a jsonb la columna nacía como `{}` y el formulario de
 * enfoque reventaba con "competencies is undefined".
 *
 * Además del default, se reparan las filas ya guardadas: la entidad las
 * normaliza al leer, pero el dato debe ser correcto también en reposo.
 */
export class CycleFocusShape1787009368635 implements MigrationInterface {
  name = 'CycleFocusShape1787009368635';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cycles" ALTER COLUMN "focus" SET DEFAULT '{"competencies": []}'`,
    );
    // `||` fusiona conservando lo ya escrito; solo toca las filas sin la clave.
    await queryRunner.query(
      `UPDATE "cycles" SET "focus" = '{"competencies": []}'::jsonb || "focus" WHERE NOT jsonb_exists("focus", 'competencies')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cycles" ALTER COLUMN "focus" SET DEFAULT '{}'`,
    );
  }
}
