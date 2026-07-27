import { NestFactory } from '@nestjs/core';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { AppModule } from '../app.module';
import {
  UnitMembership,
  UnitMembershipDocument,
} from '../units/schemas/unit-membership.schema';
import { Unit, UnitDocument } from '../units/schemas/unit.schema';
import { rebuildUnitMembership } from './rebuild-memberships/rebuild-membership';

async function rebuildUnitMemberships(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const unitModel = app.get<Model<UnitDocument>>(getModelToken(Unit.name), {
      strict: false,
    });
    const membershipModel = app.get<Model<UnitMembershipDocument>>(
      getModelToken(UnitMembership.name),
      { strict: false },
    );
    const connection = app.get<Connection>(getConnectionToken(), {
      strict: false,
    });

    const units = await unitModel.find().lean().exec();

    let totalRows = 0;

    for (const unit of units) {
      totalRows += await rebuildUnitMembership(
        {
          _id: unit._id.toString(),
          groupId: unit.groupId,
          unitLeaderId: unit.unitLeaderId.toString(),
          leaders: unit.leaders.map((id) => id.toString()),
          members: unit.members.map((id) => id.toString()),
        },
        membershipModel,
        connection,
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
