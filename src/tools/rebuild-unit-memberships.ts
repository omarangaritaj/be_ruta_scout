import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppModule } from '../app.module';
import { projectMemberships } from '../units/membership-projection';
import {
  UnitMembership,
  UnitMembershipDocument,
} from '../units/schemas/unit-membership.schema';
import { Unit, UnitDocument } from '../units/schemas/unit.schema';

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

    const units = await unitModel.find().lean().exec();

    let totalRows = 0;

    for (const unit of units) {
      const rows = projectMemberships({
        _id: unit._id.toString(),
        groupId: unit.groupId,
        unitLeaderId: unit.unitLeaderId.toString(),
        leaders: unit.leaders.map((id) => id.toString()),
        members: unit.members.map((id) => id.toString()),
      });

      await membershipModel.deleteMany({ unitId: unit._id });
      if (rows.length > 0) {
        await membershipModel.insertMany(
          rows.map((row) => ({
            userId: new Types.ObjectId(row.userId),
            unitId: new Types.ObjectId(row.unitId),
            role: row.role,
            groupId: row.groupId,
          })),
        );
      }

      totalRows += rows.length;
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
