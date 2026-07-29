import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, type AnyBulkWriteOperation } from 'mongoose';
import { AppModule } from '../app.module';
import {
  GrowthItem,
  GrowthItemDocument,
} from '../growth-items/schemas/growth-item.schema';
import catalog from './data/growth-items.json';
import { buildSeedOperations } from './growth-items-operations';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const model = app.get<Model<GrowthItemDocument>>(
      getModelToken(GrowthItem.name),
      { strict: false },
    );

    await model.syncIndexes();
    const result = await model.bulkWrite(
      buildSeedOperations(catalog) as AnyBulkWriteOperation<GrowthItem>[],
    );
    const total = await model.countDocuments().exec();

    console.log(
      `✔ Semilla lista — ${result.upsertedCount} nuevas, ${catalog.length - result.upsertedCount} ya existían, ${total} en total.`,
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
