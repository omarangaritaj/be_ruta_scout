import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificadorOutbox } from './adapters/notificador-outbox';
import { Notificador } from './notificador.port';
import {
  Notificacion,
  NotificacionSchema,
} from './schemas/notificacion.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notificacion.name, schema: NotificacionSchema },
    ]),
  ],
  providers: [{ provide: Notificador, useClass: NotificadorOutbox }],
  exports: [Notificador],
})
export class NotificacionesModule {}
