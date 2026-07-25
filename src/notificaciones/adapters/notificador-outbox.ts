import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notificador, type NuevaNotificacion } from '../notificador.port';
import {
  Notificacion,
  NotificacionDocument,
} from '../schemas/notificacion.schema';

@Injectable()
export class NotificadorOutbox extends Notificador {
  constructor(
    @InjectModel(Notificacion.name)
    private readonly model: Model<NotificacionDocument>,
  ) {
    super();
  }

  async encolar(notificacion: NuevaNotificacion): Promise<void> {
    await this.model.create({ ...notificacion, estado: 'pendiente' });
  }
}
