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
import { Cycle } from './cycle.entity';
import { createCycleSchema, type CreateCycleDto } from './dto/create-cycle.dto';
import { listCyclesSchema, type ListCyclesDto } from './dto/list-cycles.dto';
import {
  saveDiagnosticSchema,
  type SaveDiagnosticDto,
} from './dto/save-diagnostic.dto';
import {
  setActivationSchema,
  type SetActivationDto,
} from './dto/set-activation.dto';
import { updateCycleSchema, type UpdateCycleDto } from './dto/update-cycle.dto';
import { updateFocusSchema, type UpdateFocusDto } from './dto/update-focus.dto';
import { CyclesService } from './cycles.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cycles')
export class CyclesController {
  constructor(private readonly cyclesService: CyclesService) {}

  // Convención v2: ningún endpoint responde un array raíz; las listas viajan
  // como objeto con el campo nombrado por el recurso ({ cycles: [...] }).
  @Get()
  @RequirePermissions('cycle:read')
  async findAll(
    @Req() req: { user: AuthUser },
    @Query(new ZodValidationPipe(listCyclesSchema)) query: ListCyclesDto,
  ): Promise<{ cycles: Cycle[] }> {
    return { cycles: await this.cyclesService.findAll(req.user, query.unitId) };
  }

  @Get(':id')
  @RequirePermissions('cycle:read')
  async findOne(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<Cycle> {
    return this.cyclesService.findOne(req.user, id);
  }

  @Post()
  @RequirePermissions('cycle:create')
  async create(
    @Req() req: { user: AuthUser },
    @Body(new ZodValidationPipe(createCycleSchema)) dto: CreateCycleDto,
  ): Promise<Cycle> {
    return this.cyclesService.create(req.user, dto);
  }

  @Put(':id/diagnostic')
  @RequirePermissions('cycle:update')
  async saveDiagnostic(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(saveDiagnosticSchema)) dto: SaveDiagnosticDto,
  ): Promise<Cycle> {
    return this.cyclesService.saveDiagnostic(req.user, id, dto);
  }

  @Patch(':id/focus')
  @RequirePermissions('cycle:update')
  async updateFocus(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(updateFocusSchema)) dto: UpdateFocusDto,
  ): Promise<Cycle> {
    return this.cyclesService.updateFocus(req.user, id, dto);
  }

  @Patch(':id/activation')
  @RequirePermissions('cycle:update')
  async setActivation(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(setActivationSchema)) dto: SetActivationDto,
  ): Promise<Cycle> {
    return this.cyclesService.setActivation(req.user, id, dto);
  }

  @Patch(':id')
  @RequirePermissions('cycle:update')
  async update(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(updateCycleSchema)) dto: UpdateCycleDto,
  ): Promise<Cycle> {
    return this.cyclesService.update(req.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('cycle:delete')
  async remove(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    return this.cyclesService.remove(req.user, id);
  }
}
