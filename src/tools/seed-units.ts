import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UnitsService, type SeedGroupOutcome } from '../units/units.service';

type SkipReason = Extract<SeedGroupOutcome, { status: 'skipped' }>['reason'];

interface SkippedGroup {
  groupId: number;
  reason: SkipReason;
}

async function seedUnits(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const unitsService = app.get(UnitsService, { strict: false });
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name), {
      strict: false,
    });

    const groupIds = await userModel.distinct('groupId', {
      estado: true,
      groupId: { $ne: null },
    });

    let seededGroups = 0;
    let createdUnits = 0;
    const skipped: SkippedGroup[] = [];

    for (const groupId of groupIds) {
      const outcome = await unitsService.seedGroup(groupId);

      if (outcome.status === 'skipped') {
        skipped.push({ groupId, reason: outcome.reason });
        continue;
      }

      seededGroups += 1;
      createdUnits += outcome.units.length;
    }

    console.log('Resumen de siembra de unidades:');
    console.log(`  Grupos sembrados: ${seededGroups}`);
    console.log(`  Unidades creadas: ${createdUnits}`);
    console.log(`  Grupos saltados: ${skipped.length}`);
    for (const { groupId, reason } of skipped) {
      console.log(`    - grupo ${groupId}: ${reason}`);
    }
  } finally {
    await app.close();
  }
}

seedUnits()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(
      '✖ La siembra de unidades falló:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  });
