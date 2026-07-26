import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../authz/permissions.guard';
import { RequirePermissions } from '../../authz/require-permissions.decorator';
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
 * el entorno. Aun así gobierna la sincronización, por eso va tras el permiso
 * `siscout:config`.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('siscout/config')
export class SiscoutConfigController {
  constructor(private readonly configService: SiscoutConfigService) {}

  @Get()
  @RequirePermissions('siscout:config')
  get(): SiscoutConfigValues {
    return this.configService.get();
  }

  @Patch()
  @RequirePermissions('siscout:config')
  async update(
    @Body(new ZodValidationPipe(updateSiscoutConfigSchema))
    patch: UpdateSiscoutConfigDto,
  ): Promise<SiscoutConfigValues> {
    return this.configService.update(patch);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('siscout:config')
  async reset(): Promise<SiscoutConfigValues> {
    return this.configService.reset();
  }
}
