import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CARGOS,
  cargosPorNivel,
  esNivelSolicitud,
  type CargoCatalogo,
} from './catalogo-cargos';

// Catálogo de referencia: no lleva permiso, pero sí requiere sesión (lo usan
// flujos autenticados como el onboarding); no se expone a anónimos.
@UseGuards(JwtAuthGuard)
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
