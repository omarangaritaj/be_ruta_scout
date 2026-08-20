import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/require-permissions.decorator';
import { ParseUuidPipe, ZodValidationPipe } from '../common';
import {
  createProgramEventSchema,
  type CreateProgramEventDto,
} from './dto/create-program-event.dto';
import {
  listProgramEventsSchema,
  type ListProgramEventsDto,
} from './dto/list-program-events.dto';
import { rescheduleSchema, type RescheduleDto } from './dto/reschedule.dto';
import {
  saveEvaluationSchema,
  type SaveEvaluationDto,
} from './dto/save-evaluation.dto';
import {
  saveOpportunityPlanSchema,
  type SaveOpportunityPlanDto,
} from './dto/save-opportunity-plan.dto';
import {
  setOpportunitiesSchema,
  type SetOpportunitiesDto,
} from './dto/set-opportunities.dto';
import {
  updateProgramEventSchema,
  type UpdateProgramEventDto,
} from './dto/update-program-event.dto';
import { ProgramEventOpportunity } from './program-event-opportunity.entity';
import { ProgramEvent } from './program-event.entity';
import { ProgramEventsService } from './program-events.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('program-events')
export class ProgramEventsController {
  constructor(private readonly service: ProgramEventsService) {}

  // Convención v2: ningún endpoint responde un array raíz; las listas viajan
  // como objeto con el campo nombrado por el recurso ({ programEvents: [...] }).
  @Get()
  @RequirePermissions('event:read')
  async findAll(
    @Req() req: { user: AuthUser },
    @Query(new ZodValidationPipe(listProgramEventsSchema))
    query: ListProgramEventsDto,
  ): Promise<{ programEvents: ProgramEvent[] }> {
    return { programEvents: await this.service.findAll(req.user, query) };
  }

  @Get(':id')
  @RequirePermissions('event:read')
  async findOne(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<ProgramEvent> {
    return this.service.findOne(req.user, id);
  }

  @Post()
  @RequirePermissions('event:create')
  async create(
    @Req() req: { user: AuthUser },
    @Body(new ZodValidationPipe(createProgramEventSchema))
    dto: CreateProgramEventDto,
  ): Promise<ProgramEvent> {
    return this.service.create(req.user, dto);
  }

  @Patch(':id')
  @RequirePermissions('event:update')
  async update(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(updateProgramEventSchema))
    dto: UpdateProgramEventDto,
  ): Promise<ProgramEvent> {
    return this.service.update(req.user, id, dto);
  }

  @Patch(':id/schedule')
  @RequirePermissions('event:update')
  async reschedule(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(rescheduleSchema)) dto: RescheduleDto,
  ): Promise<{ event: ProgramEvent; conflicts: ProgramEvent[] }> {
    return this.service.reschedule(req.user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('event:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    return this.service.remove(req.user, id);
  }

  @Patch(':id/evaluation')
  @RequirePermissions('event:update')
  async saveEvaluation(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(saveEvaluationSchema)) dto: SaveEvaluationDto,
  ): Promise<ProgramEvent> {
    return this.service.saveEvaluation(req.user, id, dto);
  }

  @Put(':id/opportunities')
  @RequirePermissions('event:update')
  async setOpportunities(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(setOpportunitiesSchema))
    dto: SetOpportunitiesDto,
  ): Promise<{ opportunities: ProgramEventOpportunity[] }> {
    return {
      opportunities: await this.service.setOpportunities(req.user, id, dto),
    };
  }

  @Patch(':id/opportunities/:opportunityId/plan')
  @RequirePermissions('event:update')
  async saveOpportunityPlan(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Param('opportunityId', ParseUuidPipe) opportunityId: string,
    @Body(new ZodValidationPipe(saveOpportunityPlanSchema))
    dto: SaveOpportunityPlanDto,
  ): Promise<ProgramEventOpportunity> {
    return this.service.saveOpportunityPlan(req.user, id, opportunityId, dto);
  }
}
