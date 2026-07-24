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
} from '@nestjs/common';
import { ParseObjectIdPipe, ZodValidationPipe } from '../common';
import { createGrupoSchema, type CreateGrupoDto } from './dto/create-grupo.dto';
import { updateGrupoSchema, type UpdateGrupoDto } from './dto/update-grupo.dto';
import { GruposService } from './grupos.service';
import { GrupoDocument } from './schemas/grupo.schema';

@Controller('grupos')
export class GruposController {
  constructor(private readonly gruposService: GruposService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createGrupoSchema)) dto: CreateGrupoDto,
  ): Promise<GrupoDocument> {
    return this.gruposService.create(dto);
  }

  @Get()
  async findAll(): Promise<GrupoDocument[]> {
    return this.gruposService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<GrupoDocument> {
    return this.gruposService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateGrupoSchema)) dto: UpdateGrupoDto,
  ): Promise<GrupoDocument> {
    return this.gruposService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.gruposService.remove(id);
  }
}
