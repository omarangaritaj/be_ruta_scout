import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Unit, UnitDocument } from '../units/schemas/unit.schema';
import {
  planGroupSeed,
  type SeedSkipReason,
} from '../units/seeding/unit-seeder';
import { UnitsService } from '../units/units.service';

type SkipReason = SeedSkipReason | 'already-seeded';

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
    const unitModel = app.get<Model<UnitDocument>>(getModelToken(Unit.name), {
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
      // `seedGroup` no valida unidades previas: sin este chequeo, una segunda
      // corrida chocaría con el índice único (groupId, name) en `units`.
      const alreadySeeded = await unitModel.exists({ groupId });
      if (alreadySeeded) {
        skipped.push({ groupId, reason: 'already-seeded' });
        continue;
      }

      const people = await userModel
        .find({ groupId, estado: true })
        .select('_id name tipo cargoSiscout cargos districtId districtName')
        .lean()
        .exec();

      const plan = planGroupSeed({
        groupId,
        people: people.map((person) => ({
          ...person,
          _id: person._id.toString(),
        })),
      });

      if (plan.units.length === 0) {
        skipped.push({ groupId, reason: plan.skipped! });
        continue;
      }

      const created = await unitsService.seedGroup(groupId);
      seededGroups += 1;
      createdUnits += created.length;
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
