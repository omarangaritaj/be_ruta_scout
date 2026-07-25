import { Body, Controller, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common';
import {
  crearSolicitudSchema,
  type CrearSolicitudDto,
} from './dto/crear-solicitud.dto';
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
}
