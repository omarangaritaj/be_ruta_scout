import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { UnitsService, type SeedGroupOutcome } from '../units/units.service';
import { User } from '../users/user.entity';

type SkipReason = Extract<SeedGroupOutcome, { status: 'skipped' }>['reason'];

interface SkippedGroup {
  groupId: number;
  reason: SkipReason;
}

interface DiscardedRow {
  groupId: number;
  id: string;
  name: string;
  cargoSiscout?: string;
  age?: number;
}

async function seedUnits(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const unitsService = app.get(UnitsService, { strict: false });
    const dataSource = app.get(DataSource);

    const rows = await dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .select('DISTINCT user.groupId', 'groupId')
      .where('user.estado = true')
      .andWhere('user.groupId IS NOT NULL')
      .getRawMany<{ groupId: number }>();
    const groupIds = rows.map((row) => row.groupId);

    let seededGroups = 0;
    let createdUnits = 0;
    let joinedMembers = 0;
    const skipped: SkippedGroup[] = [];
    const discarded: DiscardedRow[] = [];

    for (const groupId of groupIds) {
      const outcome = await unitsService.seedGroup(groupId);

      for (const person of outcome.discarded) {
        discarded.push({ groupId, ...person });
      }

      if (outcome.status === 'skipped') {
        skipped.push({ groupId, reason: outcome.reason });
        continue;
      }

      seededGroups += 1;
      createdUnits += outcome.created.length;
      joinedMembers += outcome.joined;
    }

    console.log('Resumen de siembra de unidades:');
    console.log(`  Grupos sembrados: ${seededGroups}`);
    console.log(`  Unidades creadas: ${createdUnits}`);
    console.log(
      `  Protagonistas añadidos a unidades existentes: ${joinedMembers}`,
    );
    console.log(`  Grupos saltados: ${skipped.length}`);
    for (const { groupId, reason } of skipped) {
      console.log(`    - grupo ${groupId}: ${reason}`);
    }

    console.log(`  Protagonistas descartados: ${discarded.length}`);
    if (discarded.length > 0) {
      console.log(
        '    (ni su cargoSiscout está en el catálogo de alias de rama ni su edad cae en un tramo: se quedan sin unidad)',
      );
    }
    for (const person of discarded) {
      console.log(
        `    - grupo ${person.groupId}: ${person.id} ${person.name} — cargoSiscout: ${JSON.stringify(person.cargoSiscout ?? null)}, edad: ${person.age ?? 'sin dato'}`,
      );
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
