import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppBadRequestException } from '../common';
import { K } from '../i18n';
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
  listar(@Query('nivel') nivel?: string): { cargos: CargoCatalogo[] } {
    if (nivel === undefined) {
      return { cargos: CARGOS };
    }
    if (!esNivelSolicitud(nivel)) {
      throw new AppBadRequestException(K.VALIDATION.INVALID_LEVEL);
    }
    return { cargos: cargosPorNivel(nivel) };
  }
}
