import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/require-permissions.decorator';
import { ParseObjectIdPipe, ZodValidationPipe } from '../common';
import {
  createOpportunitySchema,
  type CreateOpportunityDto,
} from './dto/create-opportunity.dto';
import {
  updateOpportunitySchema,
  type UpdateOpportunityDto,
} from './dto/update-opportunity.dto';
import { OpportunitiesService } from './opportunities.service';
import { LearningOpportunityDocument } from './schemas/learning-opportunity.schema';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cycles')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get(':id/opportunities')
  @RequirePermissions('opportunity:read')
  async findAll(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<LearningOpportunityDocument[]> {
    return this.opportunitiesService.findAll(req.user, id);
  }

  @Post(':id/opportunities')
  @RequirePermissions('opportunity:create')
  async create(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(createOpportunitySchema))
    dto: CreateOpportunityDto,
  ): Promise<LearningOpportunityDocument> {
    return this.opportunitiesService.create(req.user, id, dto);
  }

  @Patch(':id/opportunities/:opportunityId')
  @RequirePermissions('opportunity:update')
  async update(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('opportunityId', ParseObjectIdPipe) opportunityId: string,
    @Body(new ZodValidationPipe(updateOpportunitySchema))
    dto: UpdateOpportunityDto,
  ): Promise<LearningOpportunityDocument> {
    return this.opportunitiesService.update(req.user, id, opportunityId, dto);
  }
}
