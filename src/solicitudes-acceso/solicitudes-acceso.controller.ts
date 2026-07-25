import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ParseObjectIdPipe, ZodValidationPipe } from '../common';
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

@Controller('solicitudes-acceso')
export class SolicitudesAccesoController {
  constructor(private readonly service: SolicitudesAccesoService) {}

  @Post()
  async crear(
    @Body(new ZodValidationPipe(crearSolicitudSchema)) dto: CrearSolicitudDto,
  ): Promise<SolicitudAccesoDocument> {
    return this.service.crear(dto);
  }

  @Get()
  async pendientes(): Promise<SolicitudAccesoDocument[]> {
    return this.service.listarPendientes();
  }

  @Post(':id/aprobar')
  @HttpCode(HttpStatus.OK)
  async aprobar(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(aprobarSolicitudSchema))
    dto: AprobarSolicitudDto,
  ): Promise<SolicitudAccesoDocument> {
    return this.service.aprobar(id, dto);
  }

  @Post(':id/rechazar')
  @HttpCode(HttpStatus.OK)
  async rechazar(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(rechazarSolicitudSchema))
    dto: RechazarSolicitudDto,
  ): Promise<SolicitudAccesoDocument> {
    return this.service.rechazar(id, dto);
  }
}
