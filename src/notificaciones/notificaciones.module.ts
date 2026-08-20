import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificadorOutbox } from './adapters/notificador-outbox';
import { Notificador } from './notificador.port';
import { Notificacion } from './notificacion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notificacion])],
  providers: [{ provide: Notificador, useClass: NotificadorOutbox }],
  exports: [Notificador],
})
export class NotificacionesModule {}
