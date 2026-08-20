import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../authz/permissions.guard';
import { ProgramEventsController } from './program-events.controller';
import { ProgramEventsService } from './program-events.service';

describe('ProgramEventsController', () => {
  let controller: ProgramEventsController;
  const service = {
    findAll: jest.fn().mockResolvedValue([{ id: 'evento-1' }]),
    findOne: jest.fn().mockResolvedValue({ id: 'evento-1' }),
    reschedule: jest
      .fn()
      .mockResolvedValue({ event: { id: 'evento-1' }, conflicts: [] }),
    setOpportunities: jest.fn().mockResolvedValue([{ id: 'link-1' }]),
  };

  beforeEach(async () => {
    // JwtAuthGuard y PermissionsGuard quedan fuera del árbol de este módulo
    // de pruebas: el segundo necesita PermissionsService (UsersModule +
    // RolesModule), infraestructura ajena al contrato del controlador. Se
    // sobrescriben para que Nest resuelva el grafo de DI sin levantarla.
    const moduloDePrueba = await Test.createTestingModule({
      controllers: [ProgramEventsController],
      providers: [{ provide: ProgramEventsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduloDePrueba.get(ProgramEventsController);
  });

  it('devuelve la lista envuelta, nunca un arreglo raíz', async () => {
    const respuesta = await controller.findAll({ user: { userId: 'u1' } }, {});
    expect(Array.isArray(respuesta)).toBe(false);
    expect(respuesta.programEvents).toEqual([{ id: 'evento-1' }]);
  });

  it('devuelve las oportunidades envueltas', async () => {
    const respuesta = await controller.setOpportunities(
      { user: { userId: 'u1' } },
      'evento-1',
      { opportunityIds: ['oa-1'] },
    );
    expect(respuesta.opportunities).toEqual([{ id: 'link-1' }]);
  });

  it('devuelve evento y conflictos al reprogramar', async () => {
    const respuesta = await controller.reschedule(
      { user: { userId: 'u1' } },
      'evento-1',
      {
        startDate: new Date('2026-04-17T00:00:00.000Z'),
        endDate: new Date('2026-04-17T00:00:00.000Z'),
      },
    );
    expect(respuesta.event.id).toBe('evento-1');
    expect(respuesta.conflicts).toEqual([]);
  });
});
