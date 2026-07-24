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
import {
  createUnidadSchema,
  type CreateUnidadDto,
} from './dto/create-unidad.dto';
import {
  updateUnidadSchema,
  type UpdateUnidadDto,
} from './dto/update-unidad.dto';
import { UnidadDocument } from './schemas/unidad.schema';
import { UnidadesService } from './unidades.service';

@Controller('unidades')
export class UnidadesController {
  constructor(private readonly unidadesService: UnidadesService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createUnidadSchema)) dto: CreateUnidadDto,
  ): Promise<UnidadDocument> {
    return this.unidadesService.create(dto);
  }

  @Get()
  async findAll(): Promise<UnidadDocument[]> {
    return this.unidadesService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<UnidadDocument> {
    return this.unidadesService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateUnidadSchema)) dto: UpdateUnidadDto,
  ): Promise<UnidadDocument> {
    return this.unidadesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.unidadesService.remove(id);
  }
}
