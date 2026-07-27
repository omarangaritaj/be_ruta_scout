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
  createUnidadSchema,
  type CreateUnidadDto,
} from './dto/create-unidad.dto';
import {
  declararJefaturaSchema,
  type DeclararJefaturaDto,
} from './dto/declarar-jefatura.dto';
import {
  updateUnidadSchema,
  type UpdateUnidadDto,
} from './dto/update-unidad.dto';
import { UnidadDocument } from './schemas/unidad.schema';
import { UnidadesService } from './unidades.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('unidades')
export class UnidadesController {
  constructor(private readonly unidadesService: UnidadesService) {}

  @Post()
  @RequirePermissions('unidad:create')
  async create(
    @Body(new ZodValidationPipe(createUnidadSchema)) dto: CreateUnidadDto,
  ): Promise<UnidadDocument> {
    return this.unidadesService.create(dto);
  }

  @Get()
  @RequirePermissions('unidad:read')
  async findAll(@Req() req: { user: AuthUser }): Promise<UnidadDocument[]> {
    return this.unidadesService.findAll(req.user);
  }

  @Post('jefatura')
  @RequirePermissions('unidad:read')
  async declararJefatura(
    @Req() req: { user: AuthUser },
    @Body(new ZodValidationPipe(declararJefaturaSchema))
    dto: DeclararJefaturaDto,
  ): Promise<UnidadDocument[]> {
    return this.unidadesService.declararJefatura(req.user, dto.nombreCargo);
  }

  @Get(':id')
  @RequirePermissions('unidad:read')
  async findOne(
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<UnidadDocument> {
    return this.unidadesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('unidad:update')
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateUnidadSchema)) dto: UpdateUnidadDto,
  ): Promise<UnidadDocument> {
    return this.unidadesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('unidad:delete')
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.unidadesService.remove(id);
  }
}
