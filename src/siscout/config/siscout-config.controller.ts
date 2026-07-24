import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common';
import {
  updateSiscoutConfigSchema,
  type UpdateSiscoutConfigDto,
} from './dto/update-siscout-config.dto';
import type { SiscoutConfigValues } from './siscout-config.defaults';
import { SiscoutConfigService } from './siscout-config.service';

/**
 * Configuración operativa de SiScout, editable en tiempo de ejecución.
 *
 * Es un singleton: no hay alta ni baja porque solo existe un documento de
 * ajustes. Se lee (GET), se actualiza parcialmente (PATCH) y se restablece a los
 * valores por defecto (POST /reset).
 *
 * No contiene secretos (solo tuning): credenciales y clave de cifrado siguen en
 * el entorno. PENDIENTE: proteger con guard de autenticación/rol cuando exista
 * auth, porque estos valores gobiernan la sincronización.
 */
@Controller('siscout/config')
export class SiscoutConfigController {
  constructor(private readonly configService: SiscoutConfigService) {}

  @Get()
  get(): SiscoutConfigValues {
    return this.configService.get();
  }

  @Patch()
  async update(
    @Body(new ZodValidationPipe(updateSiscoutConfigSchema))
    patch: UpdateSiscoutConfigDto,
  ): Promise<SiscoutConfigValues> {
    return this.configService.update(patch);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async reset(): Promise<SiscoutConfigValues> {
    return this.configService.reset();
  }
}
