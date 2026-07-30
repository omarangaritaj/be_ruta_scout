import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { AppBadRequestException, AppNotFoundException } from '../common';
import { CycleDocument } from '../cycles/schemas/cycle.schema';
import { CyclesService } from '../cycles/cycles.service';
import { K } from '../i18n';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import {
  LearningOpportunity,
  LearningOpportunityDocument,
  OpportunityCompetency,
} from './schemas/learning-opportunity.schema';

@Injectable()
export class OpportunitiesService {
  constructor(
    @InjectModel(LearningOpportunity.name)
    private readonly opportunityModel: Model<LearningOpportunityDocument>,
    private readonly cyclesService: CyclesService,
  ) {}

  async findAll(
    user: AuthUser,
    cycleId: string,
  ): Promise<LearningOpportunityDocument[]> {
    await this.cyclesService.findOne(user, cycleId);
    return this.opportunityModel
      .find({ cycleId, isActive: true })
      .sort({ createdAt: 1, _id: 1 })
      .exec();
  }

  async create(
    user: AuthUser,
    cycleId: string,
    dto: CreateOpportunityDto,
  ): Promise<LearningOpportunityDocument> {
    const cycle = await this.cyclesService.findOne(user, cycleId);
    const competency = this.buildCompetency(String(dto.competencyId), cycle);

    return this.opportunityModel.create({
      cycleId,
      name: dto.name,
      description: dto.description,
      protagonistVoice: dto.protagonistVoice,
      audience: dto.audience,
      competency,
    });
  }

  async update(
    user: AuthUser,
    cycleId: string,
    opportunityId: string,
    dto: UpdateOpportunityDto,
  ): Promise<LearningOpportunityDocument> {
    const cycle = await this.cyclesService.findOne(user, cycleId);
    const opportunity = await this.opportunityModel
      .findOne({ _id: opportunityId, cycleId })
      .exec();
    if (!opportunity) {
      throw new AppNotFoundException(K.OPPORTUNITIES.NOT_FOUND, {
        id: opportunityId,
      });
    }

    const { competencyId, ...rest } = dto;
    Object.assign(opportunity, rest);
    if (competencyId !== undefined) {
      opportunity.competency = this.buildCompetency(
        String(competencyId),
        cycle,
        opportunity.competency,
      );
    }
    return opportunity.save();
  }

  private buildCompetency(
    competencyId: string,
    cycle: CycleDocument,
    current?: OpportunityCompetency,
  ): OpportunityCompetency {
    if (current && String(current.growthItemId) === competencyId) {
      return current;
    }

    const fromFocus = cycle.focus.competencies.find(
      (competency) => String(competency.growthItemId) === competencyId,
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
