import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import {
  AppBadRequestException,
  AppConflictException,
  AppNotFoundException,
} from '../common';
import { Cycle } from '../cycles/cycle.entity';
import { CyclesService } from '../cycles/cycles.service';
import { isPlanningLocked } from '../cycles/planning-lock';
import { K } from '../i18n';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import {
  LearningOpportunity,
  type OpportunityCompetency,
} from './learning-opportunity.entity';

@Injectable()
export class OpportunitiesService {
  constructor(
    @InjectRepository(LearningOpportunity)
    private readonly opportunities: Repository<LearningOpportunity>,
    private readonly cyclesService: CyclesService,
  ) {}

  async findAll(
    user: AuthUser,
    cycleId: string,
  ): Promise<LearningOpportunity[]> {
    await this.cyclesService.findOne(user, cycleId);
    return this.opportunities.find({
      where: { cycleId, isActive: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async create(
    user: AuthUser,
    cycleId: string,
    dto: CreateOpportunityDto,
  ): Promise<LearningOpportunity> {
    const cycle = await this.cyclesService.findOne(user, cycleId);
    this.assertDraft(cycle);
    const competency = this.buildCompetency(dto.competencyId, cycle);

    return this.opportunities.save(
      this.opportunities.create({
        cycleId,
        name: dto.name,
        description: dto.description,
        protagonistVoice: dto.protagonistVoice,
        audience: dto.audience,
        competency,
      }),
    );
  }

  async update(
    user: AuthUser,
    cycleId: string,
    opportunityId: string,
    dto: UpdateOpportunityDto,
  ): Promise<LearningOpportunity> {
    const cycle = await this.cyclesService.findOne(user, cycleId);
    this.assertDraft(cycle);
    const opportunity = await this.opportunities.findOne({
      where: { id: opportunityId, cycleId },
    });
    if (!opportunity) {
      throw new AppNotFoundException(K.OPPORTUNITIES.NOT_FOUND, {
        id: opportunityId,
      });
    }

    const { competencyId, ...rest } = dto;
    Object.assign(opportunity, rest);
    if (competencyId !== undefined) {
      opportunity.competency = this.buildCompetency(
        competencyId,
        cycle,
        opportunity.competency,
      );
    }
    return this.opportunities.save(opportunity);
  }

  /**
   * La planeación solo se toca en borrador. El frontend ya esconde el lápiz y
   * congela las casillas cuando el ciclo está activo, pero eso es cortesía de
   * la pantalla: la regla tiene que vivir donde nadie la pueda saltar.
   */
  private assertDraft(cycle: Cycle): void {
    if (isPlanningLocked(cycle)) {
      throw new AppConflictException(K.OPPORTUNITIES.CYCLE_NOT_DRAFT);
    }
  }

  private buildCompetency(
    competencyId: string,
    cycle: Cycle,
    current?: OpportunityCompetency,
  ): OpportunityCompetency {
    if (current && current.growthItemId === competencyId) {
      return current;
    }

    const fromFocus = (cycle.focus.competencies ?? []).find(
      (competency) => competency.growthItemId === competencyId,
    );
    if (!fromFocus) {
      throw new AppBadRequestException(K.OPPORTUNITIES.UNKNOWN_COMPETENCY);
    }
    return {
      growthItemId: fromFocus.growthItemId,
      text: fromFocus.text,
      growthArea: fromFocus.growthArea,
    };
  }
}
