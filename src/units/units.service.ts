import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import {
  cargosDeJefaturaDeRama,
  ramaDeCargo,
} from '../catalogo-cargos/catalogo-cargos';
import { AppBadRequestException, AppNotFoundException } from '../common';
import { CurrentUserService } from '../current-user/current-user.service';
import { D, type Branch } from '../domain';
import { K } from '../i18n';
import { User, UserDocument } from '../users/schemas/user.schema';
import type { ConfigureUnitDto } from './dto/configure-unit.dto';
import type { UpdateUnitDto } from './dto/update-unit.dto';
import { projectMemberships } from './membership-projection';
import {
  UnitMembership,
  UnitMembershipDocument,
} from './schemas/unit-membership.schema';
import { Unit, UnitDocument } from './schemas/unit.schema';
import {
  placeholderName,
  planGroupSeed,
  type PlannedUnit,
} from './seeding/unit-seeder';
import { resolveUnitScope } from './unit-scope';

const DUPLICATE_KEY = 11000;

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === DUPLICATE_KEY
  );
}

@Injectable()
export class UnitsService {
  constructor(
    @InjectModel(Unit.name)
    private readonly unitModel: Model<UnitDocument>,
    @InjectModel(UnitMembership.name)
    private readonly membershipModel: Model<UnitMembershipDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly currentUser: CurrentUserService,
  ) {}

  async findAll(user: AuthUser): Promise<UnitDocument[]> {
    const profile = await this.currentUser.get(user.idSiscout!);
    const scope = resolveUnitScope(profile);

    switch (scope.type) {
      case 'all':
        return this.unitModel.find().exec();

      case 'group':
        return this.ofGroup(scope.groupId);

      case 'branch': {
        const units = await this.ofGroup(scope.groupId);
        return units.filter((unit) => unit.branch === scope.branch);
      }

      case 'no-group':
        throw new AppBadRequestException(K.UNITS.MISSING_GROUP);

      case 'leadership-required':
        throw new AppBadRequestException(
          K.UNITS.LEADERSHIP_REQUIRED,
          undefined,
          { jefaturas: cargosDeJefaturaDeRama() },
        );
    }
  }

  async findOne(id: string): Promise<UnitDocument> {
    const unit = await this.unitModel.findById(id).exec();
    if (!unit) throw new AppNotFoundException(K.UNITS.NOT_FOUND, { id });
    return unit;
  }

  private async ofGroup(groupId: number): Promise<UnitDocument[]> {
    const existing = await this.unitModel.find({ groupId }).exec();
    if (existing.length > 0) return existing;

    await this.seedGroup(groupId);
    return this.unitModel.find({ groupId }).exec();
  }

  async seedGroup(groupId: number): Promise<PlannedUnit[]> {
    const people = await this.userModel
      .find({ groupId, estado: true })
      .select('_id name tipo cargoSiscout cargos districtId districtName')
      .lean()
      .exec();

    const plan = planGroupSeed({
      groupId,
      people: people.map((p) => ({ ...p, _id: p._id.toString() })),
    });

    if (plan.units.length === 0) return [];

    await this.inTransaction(async (session) => {
      for (const planned of plan.units) {
        const [created] = await this.unitModel.create(
          [
            {
              ...planned,
              unitLeaderId: new Types.ObjectId(planned.unitLeaderId),
              members: planned.members.map((id) => new Types.ObjectId(id)),
            },
          ],
          { session },
        );
        await this.syncMembership(created, session);
      }
    });

    return plan.units;
  }

  private async inTransaction<T>(
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
  }

  private async syncMembership(
    unit: UnitDocument,
    session: ClientSession,
  ): Promise<void> {
    const unitId = unit._id.toString();

    const rows = projectMemberships({
      _id: unitId,
      groupId: unit.groupId,
      unitLeaderId: unit.unitLeaderId.toString(),
      leaders: unit.leaders.map((id) => id.toString()),
      members: unit.members.map((id) => id.toString()),
    });

    await this.membershipModel.deleteMany({ unitId: unit._id }, { session });
    await this.membershipModel.insertMany(
      rows.map((row) => ({
        userId: new Types.ObjectId(row.userId),
        unitId: new Types.ObjectId(row.unitId),
        role: row.role,
        groupId: row.groupId,
      })),
      { session },
    );

    await this.userModel.updateMany(
      { _id: { $in: unit.members } },
      { $set: { unitId: unit._id } },
      { session },
    );
  }

  async configure(id: string, dto: ConfigureUnitDto): Promise<UnitDocument> {
    return this.inTransaction(async (session) => {
      const unit = await this.unitModel.findById(id).session(session).exec();
      if (!unit) throw new AppNotFoundException(K.UNITS.NOT_FOUND, { id });

      unit.name = dto.name;
      unit.city = dto.city;
      unit.unitLeaderId = new Types.ObjectId(dto.unitLeaderId);
      unit.leaders = dto.leaders
        .filter((leaderId) => leaderId !== dto.unitLeaderId)
        .map((leaderId) => new Types.ObjectId(leaderId));
      unit.configuredAt = new Date();

      try {
        await unit.save({ session });
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new AppBadRequestException(K.UNITS.NAME_TAKEN);
        }
        throw error;
      }

      await this.syncMembership(unit, session);
      return unit;
    });
  }

  async setMembers(id: string, memberIds: string[]): Promise<UnitDocument[]> {
    return this.inTransaction(async (session) => {
      const unit = await this.unitModel.findById(id).session(session).exec();
      if (!unit) throw new AppNotFoundException(K.UNITS.NOT_FOUND, { id });

      const current = unit.members.map((m) => m.toString());
      const staying = new Set(memberIds);

      if (staying.size === 0) {
        throw new AppBadRequestException(K.UNITS.MEMBERS_REQUIRED);
      }
      if (memberIds.some((memberId) => !current.includes(memberId))) {
        throw new AppBadRequestException(K.UNITS.MEMBERS_NOT_IN_UNIT);
      }

      const leaving = current.filter((memberId) => !staying.has(memberId));

      unit.members = memberIds.map((memberId) => new Types.ObjectId(memberId));
      await unit.save({ session });
      await this.syncMembership(unit, session);

      if (leaving.length === 0) return [unit];

      const [clone] = await this.unitModel.create(
        [
          {
            name: await this.freeName(unit.groupId, unit.branch, session),
            branch: unit.branch,
            groupId: unit.groupId,
            districtId: unit.districtId,
            districtName: unit.districtName,
            city: unit.city,
            unitLeaderId: unit.unitLeaderId,
            leaders: [],
            members: leaving.map((memberId) => new Types.ObjectId(memberId)),
          },
        ],
        { session },
      );
      await this.syncMembership(clone, session);

      return [unit, clone];
    });
  }

  private async freeName(
    groupId: number,
    branch: Branch,
    session: ClientSession,
  ): Promise<string> {
    for (let index = 2; ; index += 1) {
      const candidate = placeholderName(branch, index);
      const taken = await this.unitModel
        .exists({ groupId, name: candidate })
        .session(session);
      if (!taken) return candidate;
    }
  }

  async update(id: string, dto: UpdateUnitDto): Promise<UnitDocument> {
    return this.inTransaction(async (session) => {
      const unit = await this.unitModel
        .findByIdAndUpdate(id, dto, {
          returnDocument: 'after',
          runValidators: true,
          session,
        })
        .exec();
      if (!unit) throw new AppNotFoundException(K.UNITS.NOT_FOUND, { id });

      await this.syncMembership(unit, session);
      return unit;
    });
  }

  async remove(id: string): Promise<void> {
    await this.inTransaction(async (session) => {
      const deleted = await this.unitModel
        .findByIdAndDelete(id, { session })
        .exec();
      if (!deleted) throw new AppNotFoundException(K.UNITS.NOT_FOUND, { id });

      await this.membershipModel.deleteMany(
        { unitId: deleted._id },
        { session },
      );
      await this.userModel.updateMany(
        { unitId: deleted._id },
        { $unset: { unitId: '' } },
        { session },
      );
    });
  }

  async declareLeadership(
    user: AuthUser,
    nombreCargo: string,
  ): Promise<UnitDocument[]> {
    const branch = ramaDeCargo(nombreCargo);
    if (!branch) {
      throw new AppBadRequestException(K.UNITS.LEADERSHIP_NOT_A_BRANCH, {
        cargo: nombreCargo,
      });
    }

    const profile = await this.currentUser.get(user.idSiscout!);
    if (!profile.groupId) {
      throw new AppBadRequestException(K.UNITS.MISSING_GROUP);
    }

    await this.userModel
      .updateOne(
        { _id: profile._id, 'cargos.nombreCargo': { $ne: nombreCargo } },
        { $push: { cargos: { nombreCargo, nivel: D.ROLE_LEVEL.RAMA } } },
      )
      .exec();
    await this.currentUser.refresh(user.idSiscout!);

    const units = await this.ofGroup(profile.groupId);
    return units.filter((unit) => unit.branch === branch);
  }
}
