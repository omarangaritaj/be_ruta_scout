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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/require-permissions.decorator';
import { ParseObjectIdPipe, ZodValidationPipe } from '../common';
import { createCycleSchema, type CreateCycleDto } from './dto/create-cycle.dto';
import { listCyclesSchema, type ListCyclesDto } from './dto/list-cycles.dto';
import { updateCycleSchema, type UpdateCycleDto } from './dto/update-cycle.dto';
import { CycleDocument } from './schemas/cycle.schema';
import { CyclesService } from './cycles.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cycles')
export class CyclesController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Get()
  @RequirePermissions('cycle:read')
  async findAll(
    @Req() req: { user: AuthUser },
    @Query(new ZodValidationPipe(listCyclesSchema)) query: ListCyclesDto,
  ): Promise<CycleDocument[]> {
    return this.cyclesService.findAll(
      req.user,
      query.unitId ? String(query.unitId) : undefined,
    );
  }

  @Get(':id')
  @RequirePermissions('cycle:read')
  async findOne(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<CycleDocument> {
    return this.cyclesService.findOne(req.user, id);
  }

  @Post()
  @RequirePermissions('cycle:create')
  async create(
    @Req() req: { user: AuthUser },
    @Body(new ZodValidationPipe(createCycleSchema)) dto: CreateCycleDto,
  ): Promise<CycleDocument> {
    return this.cyclesService.create(req.user, dto);
  }

  @Patch(':id')
  @RequirePermissions('cycle:update')
  async update(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateCycleSchema)) dto: UpdateCycleDto,
  ): Promise<CycleDocument> {
    return this.cyclesService.update(req.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('cycle:delete')
  async remove(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<void> {
    return this.cyclesService.remove(req.user, id);
  }
}
