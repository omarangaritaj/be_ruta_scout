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
import { ParseObjectIdPipe, ZodValidationPipe } from '../common';
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
import { UnitDocument } from './schemas/unit.schema';
import { UnitsService } from './units.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  @RequirePermissions('unit:read')
  async findAll(@Req() req: { user: AuthUser }): Promise<UnitDocument[]> {
    return this.unitsService.findAll(req.user);
  }

  @Get(':id')
  @RequirePermissions('unit:read')
  async findOne(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<UnitDocument> {
    return this.unitsService.findOne(req.user, id);
  }

  @Post('leadership')
  @RequirePermissions('unit:read')
  async declareLeadership(
    @Req() req: { user: AuthUser },
    @Body(new ZodValidationPipe(declareLeadershipSchema))
    dto: DeclareLeadershipDto,
  ): Promise<UnitDocument[]> {
    return this.unitsService.declareLeadership(req.user, dto.nombreCargo);
  }

  @Patch(':id/configure')
  @RequirePermissions('unit:update')
  async configure(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(configureUnitSchema)) dto: ConfigureUnitDto,
  ): Promise<UnitDocument> {
    return this.unitsService.configure(req.user, id, dto);
  }

  @Patch(':id/members')
  @RequirePermissions('unit:update', 'unit:create')
  async setMembers(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(setMembersSchema)) dto: SetMembersDto,
  ): Promise<UnitDocument[]> {
    return this.unitsService.setMembers(
      req.user,
      id,
      dto.memberIds.map((memberId) => memberId.toString()),
    );
  }

  @Patch(':id')
  @RequirePermissions('unit:update')
  async update(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateUnitSchema)) dto: UpdateUnitDto,
  ): Promise<UnitDocument> {
    return this.unitsService.update(req.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('unit:delete')
  async remove(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<void> {
    return this.unitsService.remove(req.user, id);
  }
}
