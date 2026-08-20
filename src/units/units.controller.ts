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
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/require-permissions.decorator';
import { ParseUuidPipe, ZodValidationPipe } from '../common';
import {
  configureUnitSchema,
  type ConfigureUnitDto,
} from './dto/configure-unit.dto';
import {
  declareLeadershipSchema,
  type DeclareLeadershipDto,
} from './dto/declare-leadership.dto';
import { setMembersSchema, type SetMembersDto } from './dto/set-members.dto';
import { updateUnitSchema, type UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService, type UnitPeople, type UnitView } from './units.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  // Convención v2: ningún endpoint responde un array raíz; las listas viajan
  // como objeto con el campo nombrado por el recurso ({ units: [...] }).
  @Get()
  @RequirePermissions('unit:read')
  async findAll(
    @Req() req: { user: AuthUser },
  ): Promise<{ units: UnitView[] }> {
    return { units: await this.unitsService.findAll(req.user) };
  }

  @Get(':id')
  @RequirePermissions('unit:read')
  async findOne(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<UnitView> {
    return this.unitsService.findOne(req.user, id);
  }

  @Get(':id/people')
  @RequirePermissions('unit:read')
  async people(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<UnitPeople> {
    return this.unitsService.people(req.user, id);
  }

  @Post('leadership')
  @RequirePermissions('unit:read')
  async declareLeadership(
    @Req() req: { user: AuthUser },
    @Body(new ZodValidationPipe(declareLeadershipSchema))
    dto: DeclareLeadershipDto,
  ): Promise<{ units: UnitView[] }> {
    return {
      units: await this.unitsService.declareLeadership(
        req.user,
        dto.nombreCargo,
      ),
    };
  }

  @Patch(':id/configure')
  @RequirePermissions('unit:update')
  async configure(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(configureUnitSchema)) dto: ConfigureUnitDto,
  ): Promise<UnitView> {
    return this.unitsService.configure(req.user, id, dto);
  }

  @Patch(':id/members')
  @RequirePermissions('unit:update', 'unit:create')
  async setMembers(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(setMembersSchema)) dto: SetMembersDto,
  ): Promise<{ units: UnitView[] }> {
    return {
      units: await this.unitsService.setMembers(
        req.user,
        id,
        dto.memberIds,
        dto.targetUnitId,
      ),
    };
  }

  @Patch(':id')
  @RequirePermissions('unit:update')
  async update(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(updateUnitSchema)) dto: UpdateUnitDto,
  ): Promise<UnitView> {
    return this.unitsService.update(req.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('unit:delete')
  async remove(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    return this.unitsService.remove(req.user, id);
  }
}
