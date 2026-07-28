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
import {
  buildAnswers,
  findDiagnosticProblem,
  type BuiltAnswer,
  type QuestionRef,
} from './diagnostic-validation';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { SaveDiagnosticDto } from './dto/save-diagnostic.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';
import { UpdateFocusDto } from './dto/update-focus.dto';
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
    if (!cycle || !cycle.isActive) {
      throw new AppNotFoundException(K.CYCLES.NOT_FOUND, { id });
    }
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

  async saveDiagnostic(
    user: AuthUser,
    id: string,
    dto: SaveDiagnosticDto,
  ): Promise<CycleDocument> {
    const cycle = await this.findOne(user, id);
    const unit = await this.unitInScope(user, String(cycle.unitId));
    const catalog = await this.questionsService.findActiveByBranch(unit.branch);
    const questions = catalog.map((question) => ({
      id: String(question._id),
      branch: question.branch,
      block: question.block,
      text: question.text,
    }));
    const answers = dto.answers.map((answer) => ({
      questionId: String(answer.questionId),
      score: answer.score,
      ...(answer.notes === undefined ? {} : { notes: answer.notes }),
    }));

    const problem = findDiagnosticProblem(answers, questions, unit.branch);
    if (problem === 'duplicate') {
      throw new AppBadRequestException(K.CYCLES.DUPLICATE_ANSWER);
    }
    if (problem === 'unknown-question') {
      throw new AppBadRequestException(K.QUESTIONS.INACTIVE);
    }
    if (problem === 'branch-mismatch') {
      throw new AppBadRequestException(K.QUESTIONS.BRANCH_MISMATCH);
    }

    // El diagnóstico es un registro histórico: desactivar una pregunta la saca
    // del catálogo, no borra lo que la unidad ya respondió. Como esas respuestas
    // no son editables desde la UI, se conservan aquí y no se piden al cliente.
    cycle.diagnosticAnswers = [
      ...buildAnswers(answers, questions),
      ...this.answersOutsideCatalog(cycle, questions),
    ] as never;
    if (dto.summary !== undefined) cycle.diagnosticSummary = dto.summary;
    return cycle.save();
  }

  async updateFocus(
    user: AuthUser,
    id: string,
    dto: UpdateFocusDto,
  ): Promise<CycleDocument> {
    const cycle = await this.findOne(user, id);
    Object.assign(cycle.focus, dto);
    cycle.markModified('focus');
    return cycle.save();
  }

  private answersOutsideCatalog(
    cycle: CycleDocument,
    questions: QuestionRef[],
  ): BuiltAnswer[] {
    const catalogIds = new Set(questions.map((question) => question.id));
    return cycle.diagnosticAnswers
      .filter((answer) => !catalogIds.has(String(answer.questionId)))
      .map((answer) => ({
        questionId: String(answer.questionId),
        questionText: answer.questionText,
        block: answer.block,
        score: answer.score,
        ...(answer.notes === undefined ? {} : { notes: answer.notes }),
      }));
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
