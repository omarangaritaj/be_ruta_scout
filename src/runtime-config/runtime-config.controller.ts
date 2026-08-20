import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common';
import { K, t } from '../i18n';
import { RuntimeConfigPermissionsGuard } from './runtime-config.guard';
import {
  RuntimeConfigService,
  type RuntimeConfigValues,
} from './runtime-config.service';
import type { RuntimeConfigView } from './runtime-config.types';

/**
 * El cuerpo del PATCH es un mapa `clave → valor` abierto: las claves son datos,
 * no un esquema fijo. Aquí solo se comprueba la FORMA (objeto con al menos una
 * entrada); el valor de cada clave lo valida el servicio contra el `type` y las
 * `constraints` de su propio registro.
 */
const patchSchema = z
  .record(z.string(), z.unknown())
  .refine((patch) => Object.keys(patch).length > 0, {
    error: t(K.VALIDATION.AT_LEAST_ONE_FIELD),
  });

/**
 * Configuración de la aplicación por grupos, editable en tiempo de ejecución.
 *
 * El GET devuelve valores Y metadatos (tipo, etiqueta, límites) para que el
 * panel del frontend se pinte solo: sin eso, cada configuración nueva obligaría
 * a programar su formulario, que es justo lo que este diseño elimina.
 *
 * No hay alta ni baja por HTTP: las claves nacen del catálogo del código al
 * arrancar. Se leen, se actualizan y se restablecen.
 *
 * El permiso lo resuelve `RuntimeConfigPermissionsGuard` según el grupo pedido.
 */
@UseGuards(JwtAuthGuard, RuntimeConfigPermissionsGuard)
@Controller('app-config')
export class RuntimeConfigController {
  constructor(private readonly appConfig: RuntimeConfigService) {}

  @Get(':group')
  async list(
    @Param('group') group: string,
  ): Promise<{ configs: RuntimeConfigView[] }> {
    return { configs: await this.appConfig.list(group) };
  }

  @Patch(':group')
  async update(
    @Param('group') group: string,
    @Body(new ZodValidationPipe(patchSchema)) patch: RuntimeConfigValues,
  ): Promise<{ configs: RuntimeConfigView[] }> {
    return { configs: await this.appConfig.update(group, patch) };
  }

  @Post(':group/reset')
  @HttpCode(HttpStatus.OK)
  async reset(
    @Param('group') group: string,
  ): Promise<{ configs: RuntimeConfigView[] }> {
    return { configs: await this.appConfig.reset(group) };
  }
}
