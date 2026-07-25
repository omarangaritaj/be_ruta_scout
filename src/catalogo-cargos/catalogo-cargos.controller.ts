import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  CARGOS,
  cargosPorNivel,
  esNivelSolicitud,
  type CargoCatalogo,
} from './catalogo-cargos';

@Controller('cargos')
export class CatalogoCargosController {
  @Get()
  listar(@Query('nivel') nivel?: string): CargoCatalogo[] {
    if (nivel === undefined) {
      return CARGOS;
    }
    if (!esNivelSolicitud(nivel)) {
      throw new BadRequestException(
        `nivel inválido: debe ser rama, grupo, region o nacion`,
      );
    }
    return cargosPorNivel(nivel);
  }
}
