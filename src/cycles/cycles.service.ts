import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import {
  AppBadRequestException,
  AppConflictException,
  AppForbiddenException,
  AppNotFoundException,
} from '../common';
import type { Branch } from '../domain';
import { GrowthItemsService } from '../growth-items/growth-items.service';
import { K } from '../i18n';
import { QuestionsService } from '../questions/questions.service';
import { UnitsService, type UnitView } from '../units/units.service';
import { LearningOpportunity } from '../opportunities/learning-opportunity.entity';
import { hasEnded, hasValidRange } from './cycle-dates';
import { Cycle, type CycleCompetency } from './cycle.entity';
import { isDiagnosticLocked } from './diagnostic-lock';
import { buildAnswers, findDiagnosticProblem } from './diagnostic-validation';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { SaveDiagnosticDto } from './dto/save-diagnostic.dto';
import { SetActivationDto } from './dto/set-activation.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';
import { UpdateFocusDto } from './dto/update-focus.dto';

@Injectable()
export class CyclesService {
  constructor(
    @InjectRepository(Cycle)
    private readonly cycles: Repository<Cycle>,
    @InjectRepository(LearningOpportunity)
    private readonly opportunities: Repository<LearningOpportunity>,
    private readonly unitsService: UnitsService,
    private readonly questionsService: QuestionsService,
    private readonly growthItemsService: GrowthItemsService,
  ) {}

  async findAll(user: AuthUser, unitId?: string): Promise<Cycle[]> {
    const units = await this.unitsService.findAll(user);
    const ids = units.map((unit) => unit.id);
    const reachable = unitId ? ids.filter((id) => id === unitId) : ids;
    if (reachable.length === 0) return [];
    return this.cycles.find({
      where: { isActive: true, unitId: In(reachable) },
      order: { startDate: 'DESC', id: 'ASC' },
    });
  }

  async findOne(user: AuthUser, id: string): Promise<Cycle> {
    const cycle = await this.cycles.findOne({ where: { id } });
    if (!cycle || !cycle.isActive) {
      throw new AppNotFoundException(K.CYCLES.NOT_FOUND, { id });
    }
    await this.unitInScope(user, cycle.unitId);
    return cycle;
  }

  /**
   * Activa el ciclo o lo devuelve a borrador. El estado no se guarda: lo que se
   * sella es `activatedAt`, y de ahí se derivan borrador, activo y pasado.
   *
   * Un ciclo que ya terminó no admite cambios —su estado lo fija el calendario,
   * no una persona— y activar exige al menos una oportunidad seleccionada: el
   * botón deshabilitado del frontend es una cortesía, la regla vive aquí.
   */
  async setActivation(
    user: AuthUser,
    id: string,
    dto: SetActivationDto,
  ): Promise<Cycle> {
    const cycle = await this.findOne(user, id);
    if (hasEnded(cycle.endDate, new Date())) {
      throw new AppBadRequestException(K.CYCLES.ALREADY_ENDED);
    }

    if (!dto.isActivated) {
      cycle.activatedAt = null;
      return this.cycles.save(cycle);
    }

    // Reactivar un ciclo ya activo no vuelve a sellar la fecha: la activación
    // es un hecho ocurrido una vez, no el resultado del último clic.
    if (cycle.activatedAt) return cycle;

    const selected = await this.opportunities.count({
      where: { cycleId: id, isActive: true, isSelected: true },
    });
    if (selected === 0) {
      throw new AppBadRequestException(K.CYCLES.SELECTED_OPPORTUNITY_REQUIRED);
    }

    cycle.activatedAt = new Date();
    return this.cycles.save(cycle);
  }

  async create(user: AuthUser, dto: CreateCycleDto): Promise<Cycle> {
    await this.unitInScope(user, dto.unitId);
    // El ciclo nace con la forma completa del jsonb: la respuesta del POST se
    // pinta directamente, y ahí no hay lectura que dispare `normalizarFocus`.
    return this.cycles.save(
      this.cycles.create({
        ...dto,
        diagnosticAnswers: [],
        focus: { competencies: [] },
      }),
    );
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateCycleDto,
  ): Promise<Cycle> {
    const cycle = await this.findOne(user, id);
    const startDate = dto.startDate ?? cycle.startDate;
    const endDate = dto.endDate ?? cycle.endDate;
    // El rango se revalida aquí, no solo en el DTO: editar una sola fecha la
    // combina con la guardada, y ese par el DTO no puede verlo.
    if (!hasValidRange(startDate, endDate)) {
      throw new AppBadRequestException(K.CYCLES.INVALID_DATE_RANGE);
    }
    Object.assign(cycle, dto);
    return this.cycles.save(cycle);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const cycle = await this.findOne(user, id);
    cycle.isActive = false;
    await this.cycles.save(cycle);
  }

  async saveDiagnostic(
    user: AuthUser,
    id: string,
    dto: SaveDiagnosticDto,
  ): Promise<Cycle> {
    const cycle = await this.findOne(user, id);
    if (isDiagnosticLocked(cycle)) {
      throw new AppConflictException(K.CYCLES.DIAGNOSTIC_LOCKED);
    }

    const unit = await this.unitInScope(user, cycle.unitId);
    const catalog = await this.questionsService.findActiveByBranch(unit.branch);
    const questions = catalog.map((question) => ({
      id: question.id,
      branch: question.branch,
      block: question.block,
      text: question.text,
    }));
    const answers = dto.answers.map((answer) => ({
      questionId: answer.questionId,
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
    if (problem === 'incomplete') {
      throw new AppBadRequestException(K.CYCLES.DIAGNOSTIC_INCOMPLETE);
    }

    cycle.diagnosticAnswers = buildAnswers(answers, questions);
    cycle.diagnosticSummary = dto.summary;
    return this.cycles.save(cycle);
  }

  async updateFocus(
    user: AuthUser,
    id: string,
    dto: UpdateFocusDto,
  ): Promise<Cycle> {
    const cycle = await this.findOne(user, id);
    const { competencies: competencyIds, ...rest } = dto;

    if (competencyIds === undefined) {
      cycle.focus = { ...cycle.focus, ...rest };
      return this.cycles.save(cycle);
    }

    const unit = await this.unitInScope(user, cycle.unitId);
    const competencies = await this.buildCompetencies(
      competencyIds,
      unit.branch,
      cycle.focus.competencies ?? [],
    );

    cycle.focus = { ...cycle.focus, ...rest, competencies };
    return this.cycles.save(cycle);
  }

  private async buildCompetencies(
    ids: string[],
    branch: Branch,
    storedCompetencies: CycleCompetency[],
  ): Promise<CycleCompetency[]> {
    if (new Set(ids).size !== ids.length) {
      throw new AppBadRequestException(K.CYCLES.DUPLICATE_COMPETENCY);
    }

    const catalog = await this.growthItemsService.findAll(branch);
    const byId = new Map(catalog.map((item) => [item.id, item]));
    const storedById = new Map(
      storedCompetencies.map((competency) => [
        competency.growthItemId,
        competency,
      ]),
    );

    return ids.map((growthItemId) => {
      const item = byId.get(growthItemId);
      if (item) {
        return {
          growthItemId,
          text: item.text,
          growthArea: item.growthArea,
        };
      }

      // Un ítem borrado del catálogo sigue siendo válido si ya estaba
      // guardado en el enfoque: un documento firmado sigue diciendo lo que
      // dijo (decisiones 2.3 y 3.2), así que se conserva su snapshot tal cual.
      const stored = storedById.get(growthItemId);
      if (stored) {
        return {
          growthItemId,
          text: stored.text,
          growthArea: stored.growthArea,
        };
      }

      throw new AppBadRequestException(K.CYCLES.UNKNOWN_COMPETENCY);
    });
  }

  /**
   * La unidad del ciclo, cargada y autorizada por UnitsService: la misma
   * puerta `authorize` de las operaciones de unidades decide el alcance
   * (sustituye a resolveUnitScope + CurrentUserService del sistema anterior).
   * El 403 se re-etiqueta con la clave de ciclos porque para quien llamó el
   * recurso fuera de alcance es el ciclo, no la unidad.
   */
  private async unitInScope(user: AuthUser, unitId: string): Promise<UnitView> {
    try {
      return await this.unitsService.findOne(user, unitId);
    } catch (error) {
      if (error instanceof AppForbiddenException) {
        throw new AppForbiddenException(K.CYCLES.OUT_OF_SCOPE);
      }
      throw error;
    }
  }
}
