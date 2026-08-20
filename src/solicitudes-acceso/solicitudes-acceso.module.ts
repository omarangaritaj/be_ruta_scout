import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { RolesModule } from '../roles/roles.module';
import { SiscoutModule } from '../siscout/siscout.module';
import { UsersModule } from '../users/users.module';
import { SolicitudAcceso } from './solicitud-acceso.entity';
import { SolicitudesAccesoController } from './solicitudes-acceso.controller';
import { SolicitudesAccesoService } from './solicitudes-acceso.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SolicitudAcceso]),
    UsersModule,
    // Aprobar puede conceder roles: hace falta el repositorio de `Role` para
    // comprobar que los ids existen antes de escribir la tabla puente.
    RolesModule,
    NotificacionesModule,
    SiscoutModule,
  ],
  controllers: [SolicitudesAccesoController],
  providers: [SolicitudesAccesoService],
  exports: [TypeOrmModule],
})
export class SolicitudesAccesoModule {}
