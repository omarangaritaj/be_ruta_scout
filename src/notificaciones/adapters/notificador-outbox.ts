import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificador, type NuevaNotificacion } from '../notificador.port';
import { ESTADO_NOTIFICACION, Notificacion } from '../notificacion.entity';

@Injectable()
export class NotificadorOutbox extends Notificador {
  constructor(
    @InjectRepository(Notificacion)
    private readonly notificaciones: Repository<Notificacion>,
  ) {
    super();
  }

  async encolar(notificacion: NuevaNotificacion): Promise<void> {
    await this.notificaciones.save(
      this.notificaciones.create({
        ...notificacion,
        estado: ESTADO_NOTIFICACION.PENDIENTE,
      }),
    );
  }
}
