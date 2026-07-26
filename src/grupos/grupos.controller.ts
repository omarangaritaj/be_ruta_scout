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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/require-permissions.decorator';
import { ParseObjectIdPipe, ZodValidationPipe } from '../common';
import { createGrupoSchema, type CreateGrupoDto } from './dto/create-grupo.dto';
import { updateGrupoSchema, type UpdateGrupoDto } from './dto/update-grupo.dto';
import { GruposService } from './grupos.service';
import { GrupoDocument } from './schemas/grupo.schema';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('grupos')
export class GruposController {
  constructor(private readonly gruposService: GruposService) {}

  @Post()
  @RequirePermissions('grupo:create')
  async create(
    @Body(new ZodValidationPipe(createGrupoSchema)) dto: CreateGrupoDto,
  ): Promise<GrupoDocument> {
    return this.gruposService.create(dto);
  }

  @Get()
  @RequirePermissions('grupo:read')
  async findAll(): Promise<GrupoDocument[]> {
    return this.gruposService.findAll();
  }

  @Get(':id')
  @RequirePermissions('grupo:read')
  async findOne(
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<GrupoDocument> {
    return this.gruposService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('grupo:update')
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateGrupoSchema)) dto: UpdateGrupoDto,
  ): Promise<GrupoDocument> {
    return this.gruposService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('grupo:delete')
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.gruposService.remove(id);
  }
}
