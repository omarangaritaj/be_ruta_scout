import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Unit } from '../units/unit.entity';
import { rebuildUnitMembership } from './rebuild-memberships/rebuild-membership';

async function rebuildUnitMemberships(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const dataSource = app.get(DataSource);

    const units = await dataSource.getRepository(Unit).find({
      relations: { leaders: true, members: true },
    });

    let totalRows = 0;

    for (const unit of units) {
      totalRows += await rebuildUnitMembership(
        {
          id: unit.id,
          groupId: unit.groupId,
          leaderId: unit.leaderId,
          leaders: unit.leaders.map((leader) => leader.id),
          members: unit.members.map((member) => member.id),
        },
        dataSource,
      );
    }

    console.log(
      `✔ Reconstrucción de membresías lista: ${units.length} unidades procesadas, ${totalRows} filas en unit_memberships.`,
    );
  } finally {
    await app.close();
  }
}

rebuildUnitMemberships()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(
      '✖ La reconstrucción de membresías falló:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  });
