import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { GrowthItem } from '../growth-items/growth-item.entity';
import catalog from './data/growth-items.json';

/**
 * Siembra el catálogo completo de dimensiones/objetivos de crecimiento.
 *
 * `orIgnore` (ON CONFLICT DO NOTHING sobre el índice único branch+área+orden)
 * y nunca un update: la semilla puebla, no reconcilia. Un item ya existente
 * conserva el texto y el estado que le haya dado un administrador — misma
 * semántica que el `$setOnInsert` del sistema anterior.
 */
async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const dataSource = app.get(DataSource);
    const repo = dataSource.getRepository(GrowthItem);

    const result = await repo
      .createQueryBuilder()
      .insert()
      .values(
        catalog.map((item) => ({
          branch: item.branch as GrowthItem['branch'],
          growthArea: item.growthArea as GrowthItem['growthArea'],
          order: item.order,
          text: item.text,
          isActive: true,
        })),
      )
      .orIgnore()
      .execute();

    const insertadas = result.identifiers.filter(Boolean).length;
    const total = await repo.count();

    console.log(
      `✔ Semilla lista — ${insertadas} nuevas, ${catalog.length - insertadas} ya existían, ${total} en total.`,
    );
  } finally {
    await app.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('✖ Semilla de dimensiones falló:', error);
    process.exit(1);
  });
