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
import { ParseObjectIdPipe, ZodValidationPipe } from '../common';
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
import { SolicitudAccesoDocument } from './schemas/solicitud-acceso.schema';
import { SolicitudesAccesoService } from './solicitudes-acceso.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('solicitudes-acceso')
export class SolicitudesAccesoController {
  constructor(private readonly service: SolicitudesAccesoService) {}

  @Post()
  async crear(
    @Req() req: { user: AuthUser },
    @Body(new ZodValidationPipe(crearSolicitudSchema)) dto: CrearSolicitudDto,
  ): Promise<SolicitudAccesoDocument> {
    return this.service.crear(req.user.userId, dto);
  }

  @Get('contexto')
  async contexto(@Req() req: { user: AuthUser }) {
    return this.service.contextoOnboarding(req.user.userId);
  }

  @Get()
  @RequirePermissions('solicitud:read')
  async pendientes(): Promise<SolicitudAccesoDocument[]> {
    return this.service.listarPendientes();
  }

  @Get(':id')
  @RequirePermissions('solicitud:read')
  async detalle(
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<SolicitudAccesoDocument> {
    return this.service.findOne(id);
  }

  @Post(':id/aprobar')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('solicitud:approve')
  async aprobar(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(aprobarSolicitudSchema))
    dto: AprobarSolicitudDto,
  ): Promise<SolicitudAccesoDocument> {
    return this.service.aprobar(id, dto);
  }

  @Post(':id/rechazar')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('solicitud:reject')
  async rechazar(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(rechazarSolicitudSchema))
    dto: RechazarSolicitudDto,
  ): Promise<SolicitudAccesoDocument> {
    return this.service.rechazar(id, dto);
  }
}
