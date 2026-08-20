import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ParseUuidPipe, ZodValidationPipe } from '../common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/require-permissions.decorator';
import {
  crearSolicitudSchema,
  type CrearSolicitudDto,
} from './dto/crear-solicitud.dto';
import {
  aprobarSolicitudSchema,
  rechazarSolicitudSchema,
  type AprobarSolicitudDto,
  type RechazarSolicitudDto,
} from './dto/resolver-solicitud.dto';
import { SolicitudAcceso } from './solicitud-acceso.entity';
import { SolicitudesAccesoService } from './solicitudes-acceso.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('solicitudes-acceso')
export class SolicitudesAccesoController {
  constructor(private readonly service: SolicitudesAccesoService) {}

  @Post()
  async crear(
    @Req() req: { user: AuthUser },
    @Body(new ZodValidationPipe(crearSolicitudSchema)) dto: CrearSolicitudDto,
  ): Promise<SolicitudAcceso> {
    return this.service.crear(req.user.userId, dto);
  }

  @Get('contexto')
  async contexto(@Req() req: { user: AuthUser }) {
    return this.service.contextoOnboarding(req.user.userId);
  }

  @Get()
  @RequirePermissions('solicitud:read')
  async pendientes(): Promise<{ solicitudes: SolicitudAcceso[] }> {
    return { solicitudes: await this.service.listarPendientes() };
  }

  @Get(':id')
  @RequirePermissions('solicitud:read')
  async detalle(
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<SolicitudAcceso> {
    return this.service.findOne(id);
  }

  @Post(':id/aprobar')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('solicitud:approve')
  async aprobar(
    @Req() req: { user: AuthUser },
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(aprobarSolicitudSchema))
    dto: AprobarSolicitudDto,
  ): Promise<SolicitudAcceso> {
    return this.service.aprobar(req.user.userId, id, dto);
  }

  @Post(':id/rechazar')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('solicitud:reject')
  async rechazar(
    @Param('id', ParseUuidPipe) id: string,
    @Body(new ZodValidationPipe(rechazarSolicitudSchema))
    dto: RechazarSolicitudDto,
  ): Promise<SolicitudAcceso> {
    return this.service.rechazar(id, dto);
  }
}
