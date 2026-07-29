import { NestFactory } from '@nestjs/core';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AppModule } from '../app.module';
import { D } from '../domain';
import {
  UnitMembership,
  UnitMembershipDocument,
} from '../units/schemas/unit-membership.schema';
import { Unit, UnitDocument } from '../units/schemas/unit.schema';
import { leadersOfBranch } from '../units/seeding/leader-resolution';
import { User, UserDocument } from '../users/schemas/user.schema';
import { rebuildUnitMembership } from './rebuild-memberships/rebuild-membership';

/**
 * Las unidades sembradas antes de que `planGroupSeed` resolviera la jefatura de
 * rama nacieron con `leaders: []`. Sin fila propia en `unit_memberships`, el
 * bucket `units_of_the_member` de PowerSync no le baja al subjefe ni un solo
 * protagonista, así que hay que rellenarlas sin borrar y volver a sembrar.
 */
async function backfillUnitLeaders(): Promise<void> {
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
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name), {
      strict: false,
    });
    const connection = app.get<Connection>(getConnectionToken(), {
      strict: false,
    });

    const units = await unitModel.find().exec();
    const adultsByGroup = new Map<number, AdultCandidate[]>();

    let updated = 0;
    let totalRows = 0;

    for (const unit of units) {
      const adults = await adultsOfGroup(
        unit.groupId,
        userModel,
        adultsByGroup,
      );
      const leaderId = unit.unitLeaderId.toString();
      const assistants = leadersOfBranch(unit.branch, adults)
        .filter((candidate) => candidate._id !== leaderId)
        .map((candidate) => candidate._id);

      if (!changed(unit.leaders, assistants)) continue;

      unit.leaders = assistants.map((id) => new Types.ObjectId(id));
      await unit.save();
      updated += 1;

      totalRows += await rebuildUnitMembership(
        {
          _id: unit._id.toString(),
          groupId: unit.groupId,
          unitLeaderId: leaderId,
          leaders: assistants,
          members: unit.members.map((id) => id.toString()),
        },
        membershipModel,
        connection,
      );
    }

    console.log(
      `✔ Jefaturas de rama al día: ${units.length} unidades revisadas, ${updated} actualizadas, ${totalRows} filas reescritas en unit_memberships.`,
    );
  } finally {
    await app.close();
  }
}

interface AdultCandidate {
  _id: string;
  name: string;
  cargoSiscout?: string;
  cargos?: { nombreCargo: string; nivel: string }[];
}

async function adultsOfGroup(
  groupId: number,
  userModel: Model<UserDocument>,
  cache: Map<number, AdultCandidate[]>,
): Promise<AdultCandidate[]> {
  const cached = cache.get(groupId);
  if (cached) return cached;

  const adults = await userModel
    .find({ groupId, estado: true, tipo: D.PERSON_TYPE.ADULT })
    .select('_id name cargoSiscout cargos')
    .lean()
    .exec();

  const candidates = adults.map((adult) => ({
    _id: adult._id.toString(),
    name: adult.name,
    cargoSiscout: adult.cargoSiscout,
    cargos: adult.cargos,
  }));

  cache.set(groupId, candidates);
  return candidates;
}

function changed(current: Types.ObjectId[], next: string[]): boolean {
  const before = current.map((id) => id.toString()).sort();
  const after = [...next].sort();
  return before.join() !== after.join();
}

backfillUnitLeaders()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(
      '✖ El relleno de jefaturas falló:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  });
