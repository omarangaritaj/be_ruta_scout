import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import {
  AppBadRequestException,
  AppForbiddenException,
  AppNotFoundException,
} from '../common';
import { CurrentUserService } from '../current-user/current-user.service';
import { K } from '../i18n';
import { QuestionsService } from '../questions/questions.service';
import { Unit, UnitDocument } from '../units/schemas/unit.schema';
import { resolveUnitScope, scopeReaches } from '../units/unit-scope';
import { hasValidRange } from './cycle-dates';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';
import { Cycle, CycleDocument } from './schemas/cycle.schema';

@Injectable()
export class CyclesService {
  constructor(
    @InjectModel(Cycle.name)
    private readonly cycleModel: Model<CycleDocument>,
    @InjectModel(Unit.name)
    private readonly unitModel: Model<UnitDocument>,
    private readonly questionsService: QuestionsService,
    private readonly currentUser: CurrentUserService,
  ) {}

  async findAll(user: AuthUser, unitId?: string): Promise<CycleDocument[]> {
    const units = await this.reachableUnits(user);
    const ids = units.map((unit) => unit._id);
    const filter: Record<string, unknown> = {
      isActive: true,
      unitId: { $in: unitId ? ids.filter((id) => String(id) === unitId) : ids },
    };
    return this.cycleModel.find(filter).sort({ startDate: -1, _id: 1 }).exec();
  }

  async findOne(user: AuthUser, id: string): Promise<CycleDocument> {
    const cycle = await this.cycleModel.findById(id).exec();
    if (!cycle) throw new AppNotFoundException(K.CYCLES.NOT_FOUND, { id });
    await this.unitInScope(user, String(cycle.unitId));
    return cycle;
  }

  async create(user: AuthUser, dto: CreateCycleDto): Promise<CycleDocument> {
    await this.unitInScope(user, String(dto.unitId));
    return this.cycleModel.create(dto);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateCycleDto,
  ): Promise<CycleDocument> {
    const cycle = await this.findOne(user, id);
    const startDate = dto.startDate ?? cycle.startDate;
    const endDate = dto.endDate ?? cycle.endDate;
    // El rango se revalida aquí, no solo en el DTO: editar una sola fecha la
    // combina con la guardada, y ese par el DTO no puede verlo.
    if (!hasValidRange(startDate, endDate)) {
      throw new AppBadRequestException(K.CYCLES.INVALID_DATE_RANGE);
    }
    cycle.set(dto);
    return cycle.save();
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const cycle = await this.findOne(user, id);
    cycle.isActive = false;
    await cycle.save();
  }

  private async reachableUnits(user: AuthUser): Promise<UnitDocument[]> {
    const profile = await this.currentUser.get(user.idSiscout!);
    const scope = resolveUnitScope(profile);
    const units = await this.unitModel.find({}).exec();
    return units.filter((unit) =>
      scopeReaches(scope, { groupId: unit.groupId, branch: unit.branch }),
    );
  }

  private async unitInScope(
    user: AuthUser,
    unitId: string,
  ): Promise<UnitDocument> {
    const unit = await this.unitModel.findById(unitId).exec();
    if (!unit)
      throw new AppNotFoundException(K.UNITS.NOT_FOUND, { id: unitId });
    const profile = await this.currentUser.get(user.idSiscout!);
    const scope = resolveUnitScope(profile);
    if (!scopeReaches(scope, { groupId: unit.groupId, branch: unit.branch })) {
      throw new AppForbiddenException(K.CYCLES.OUT_OF_SCOPE);
    }
    return unit;
  }
}
