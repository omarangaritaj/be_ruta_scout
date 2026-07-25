import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { SiscoutModule } from '../siscout/siscout.module';
import { UsersModule } from '../users/users.module';
import {
  SolicitudAcceso,
  SolicitudAccesoSchema,
} from './schemas/solicitud-acceso.schema';
import { SolicitudesAccesoController } from './solicitudes-acceso.controller';
import { SolicitudesAccesoService } from './solicitudes-acceso.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SolicitudAcceso.name, schema: SolicitudAccesoSchema },
    ]),
    UsersModule,
    NotificacionesModule,
    SiscoutModule,
  ],
  controllers: [SolicitudesAccesoController],
  providers: [SolicitudesAccesoService],
  exports: [MongooseModule],
})
export class SolicitudesAccesoModule {}
