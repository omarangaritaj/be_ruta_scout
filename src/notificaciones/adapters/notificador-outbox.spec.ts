import { NotificadorOutbox } from './notificador-outbox';

describe('NotificadorOutbox', () => {
  it('encola una notificación pendiente con sus datos', async () => {
    const creados: unknown[] = [];
    const model = {
      create: (doc: unknown) => {
        creados.push(doc);
        return Promise.resolve(doc);
      },
    };
    const outbox = new NotificadorOutbox(model as never);

    await outbox.encolar({
      tipo: 'solicitud_recibida',
      destinatario: { personaId: 'p1' },
      datos: { nivel: 'grupo' },
    });

    expect(creados[0]).toMatchObject({
      tipo: 'solicitud_recibida',
      estado: 'pendiente',
      datos: { nivel: 'grupo' },
    });
  });
});
