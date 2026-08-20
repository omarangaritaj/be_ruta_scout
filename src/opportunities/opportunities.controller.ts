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
import { ParseUuidPipe, ZodValidationPipe } from '../common';
import {
  createOpportunitySchema,
  type CreateOpportunityDto,
} from './dto/create-opportunity.dto';
import {
  updateOpportunitySchema,
  type UpdateOpportunityDto,
} from './dto/update-opportunity.dto';
import { LearningOpportunity } from './learning-opportunity.entity';
import { OpportunitiesService } from './opportunities.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cycles')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  // Convención v2: ningún endpoint responde un array raíz; las listas viajan
  // como objeto con el campo nombrado por el recurso ({ opportunities: [...] }).
  @Get(':id/opportunities')
  @RequirePermissions('opportunity:read')
  async findAll(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<{ opportunities: LearningOpportunity[] }> {
    return {
      opportunities: await this.opportunitiesService.findAll(req.user, id),
    };
  }

  @Post(':id/opportunities')
  @RequirePermissions('opportunity:create')
  async create(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(createOpportunitySchema))
    dto: CreateOpportunityDto,
  ): Promise<LearningOpportunity> {
    return this.opportunitiesService.create(req.user, id, dto);
  }

  @Patch(':id/opportunities/:opportunityId')
  @RequirePermissions('opportunity:update')
  async update(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Param('opportunityId', ParseUuidPipe) opportunityId: string,
    @Body(new ZodValidationPipe(updateOpportunitySchema))
    dto: UpdateOpportunityDto,
  ): Promise<LearningOpportunity> {
    return this.opportunitiesService.update(req.user, id, opportunityId, dto);
  }
}
