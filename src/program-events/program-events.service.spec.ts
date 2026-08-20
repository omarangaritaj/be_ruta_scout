import { In } from 'typeorm';
import {
  AppBadRequestException,
  AppConflictException,
  AppForbiddenException,
} from '../common';
import { ProgramEventsService } from './program-events.service';

/**
 * Simula la violación de `UX_program_events_reunion_fecha` tal como TypeORM
 * la envuelve: un `QueryFailedError` con `driverError.code === '23505'`. Es
 * el mismo shape que reconoce `isDuplicateKey` en `growth-items.service.ts`.
 */
const ERROR_UNICIDAD = { driverError: { code: '23505' } };

const UNIDAD = '11111111-1111-4111-8111-111111111111';
const CICLO = '22222222-2222-4222-8222-222222222222';
const OTRA_UNIDAD = '33333333-3333-4333-8333-333333333333';
// "Hoy" de referencia para las pruebas: cae dentro del rango de cicloActivo
// (2026-03-01 a 2026-06-30). No se usa `new Date()` real porque
// `validarContraCiclo` compara contra el reloj, y anclar las pruebas al
// reloj de verdad las haría depender de cuándo se ejecutan.
const HOY_DENTRO_DEL_CICLO = new Date('2026-04-05T00:00:00.000Z');

const cicloActivo = {
  id: CICLO,
  unitId: UNIDAD,
  startDate: new Date('2026-03-01T00:00:00.000Z'),
  endDate: new Date('2026-06-30T00:00:00.000Z'),
  activatedAt: new Date('2026-03-01T00:00:00.000Z'),
  isActive: true,
};

const dtoReunion = {
  kind: 'reunion' as const,
  unitId: UNIDAD,
  cycleId: CICLO,
  scope: 'rama' as const,
  name: 'Rastreo en el bosque',
  startDate: new Date('2026-04-10T00:00:00.000Z'),
  endDate: new Date('2026-04-10T00:00:00.000Z'),
  place: 'Parque El Salitre',
  safeguarding: {
    buttonReady: true,
    buttonReachable: true,
    usageKnown: true,
    inclusionAdjustment: false,
  },
  riskManagement: { checks: [true, true, true, true], risks: [] },
  agenda: [],
  adultTeam: [],
  materials: [],
  participatingUnitIds: [],
};

function construir(
  overrides: {
    ciclo?: unknown;
    nivel?: string;
  } = {},
) {
  const events = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: Record<string, unknown>) =>
      Promise.resolve({ id: 'nuevo', ...data }),
    ),
  };
  const cycles = {
    findOne: jest
      .fn()
      .mockResolvedValue('ciclo' in overrides ? overrides.ciclo : cicloActivo),
  };
  const links = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: unknown) => Promise.resolve(data)),
  };
  const oportunidades = { find: jest.fn().mockResolvedValue([]) };
  const unitsService = {
    findAll: jest.fn().mockResolvedValue([{ id: UNIDAD }]),
  };
  const service = new ProgramEventsService(
    events as never,
    links as never,
    cycles as never,
    unitsService as never,
    oportunidades as never,
  );
  const user = {
    userId: 'usuario-1',
    accessLevel: overrides.nivel ?? 'grupo',
  };
  return { service, events, cycles, links, oportunidades, unitsService, user };
}

describe('ProgramEventsService.create', () => {
  it('crea una reunión dentro del ciclo activo', async () => {
    const { service, events, user } = construir();
    await service.create(user as never, dtoReunion, HOY_DENTRO_DEL_CICLO);
    expect(events.save).toHaveBeenCalled();
  });

  it('rechaza una reunión fuera del rango del ciclo', async () => {
    const { service, user } = construir();
    await expect(
      service.create(user as never, {
        ...dtoReunion,
        startDate: new Date('2026-07-15T00:00:00.000Z'),
        endDate: new Date('2026-07-15T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('rechaza una reunión cuando el ciclo no está activo', async () => {
    const { service, user } = construir({
      ciclo: { ...cicloActivo, activatedAt: null },
    });
    await expect(
      service.create(user as never, dtoReunion as never),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('rechaza un alcance por encima del nivel del actor', async () => {
    const { service, user } = construir({ nivel: 'rama' });
    await expect(
      service.create(
        user as never,
        {
          ...dtoReunion,
          kind: 'actividad',
          scope: 'grupo',
          cycleId: undefined,
        } as never,
      ),
    ).rejects.toBeInstanceOf(AppForbiddenException);
  });

  it('crea una actividad sin ciclo sin consultar rangos', async () => {
    const { service, cycles, user } = construir();
    await service.create(
      user as never,
      {
        ...dtoReunion,
        kind: 'actividad',
        scope: 'grupo',
        cycleId: undefined,
        startDate: new Date('2026-09-12T00:00:00.000Z'),
        endDate: new Date('2026-09-14T00:00:00.000Z'),
      } as never,
    );
    expect(cycles.findOne).not.toHaveBeenCalled();
  });

  it('rechaza colgar una reunión de un ciclo activo de otra unidad', async () => {
    const { service, user } = construir({
      ciclo: { ...cicloActivo, unitId: OTRA_UNIDAD },
    });
    await expect(
      service.create(user as never, dtoReunion, HOY_DENTRO_DEL_CICLO),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('rechaza una reunión cuando el ciclo ya venció', async () => {
    const { service, user } = construir();
    const hoyDespuesDelCiclo = new Date('2026-07-01T00:00:00.000Z');
    await expect(
      service.create(user as never, dtoReunion, hoyDespuesDelCiclo),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('rechaza una reunión cuando el ciclo está dado de baja aunque siga activado', async () => {
    const { service, user } = construir({
      ciclo: { ...cicloActivo, isActive: false },
    });
    await expect(
      service.create(user as never, dtoReunion, HOY_DENTRO_DEL_CICLO),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('rechaza crear en una unidad fuera del alcance del actor', async () => {
    const { service, unitsService, user } = construir();
    unitsService.findAll.mockResolvedValue([{ id: OTRA_UNIDAD }]);
    await expect(
      service.create(user as never, dtoReunion),
    ).rejects.toBeInstanceOf(AppForbiddenException);
  });
});

// H1: una ACTIVIDAD con `cycleId` debe pasar por la misma validación de
// ciclo que una reunión. La guarda original comparaba `dto.kind === 'reunion'`
// y dejaba que una actividad colgara de cualquier ciclo sin tocar la tabla
// `cycles`: ni existencia, ni unidad, ni vigencia, ni rango de fechas.
describe('ProgramEventsService.create — H1 ciclo en actividades', () => {
  const dtoActividadConCiclo = {
    ...dtoReunion,
    kind: 'actividad' as const,
    scope: 'grupo' as const,
  };

  it('rechaza una actividad colgada de un ciclo de otra unidad', async () => {
    const { service, cycles, user } = construir({
      ciclo: { ...cicloActivo, unitId: OTRA_UNIDAD },
    });
    await expect(
      service.create(
        user as never,
        dtoActividadConCiclo as never,
        HOY_DENTRO_DEL_CICLO,
      ),
    ).rejects.toBeInstanceOf(AppBadRequestException);
    expect(cycles.findOne).toHaveBeenCalled();
  });

  it('rechaza una actividad colgada de un ciclo ya vencido', async () => {
    const { service, cycles, user } = construir();
    const hoyDespuesDelCiclo = new Date('2026-07-01T00:00:00.000Z');
    await expect(
      service.create(
        user as never,
        dtoActividadConCiclo as never,
        hoyDespuesDelCiclo,
      ),
    ).rejects.toBeInstanceOf(AppBadRequestException);
    expect(cycles.findOne).toHaveBeenCalled();
  });

  it('rechaza una actividad cuyas fechas caen fuera del rango del ciclo al que se ancla', async () => {
    const { service, user } = construir();
    await expect(
      service.create(
        user as never,
        {
          ...dtoActividadConCiclo,
          startDate: new Date('2026-07-15T00:00:00.000Z'),
          endDate: new Date('2026-07-15T00:00:00.000Z'),
        },
        HOY_DENTRO_DEL_CICLO,
      ),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('acepta una actividad colgada de un ciclo válido de la propia unidad', async () => {
    const { service, events, cycles, user } = construir();
    await service.create(
      user as never,
      dtoActividadConCiclo,
      HOY_DENTRO_DEL_CICLO,
    );
    expect(cycles.findOne).toHaveBeenCalled();
    expect(events.save).toHaveBeenCalled();
  });
});

describe('ProgramEventsService.update — H1 ciclo en actividades', () => {
  const eventoActividad = {
    id: 'evento-1',
    unitId: UNIDAD,
    cycleId: null,
    kind: 'actividad' as const,
    scope: 'grupo' as const,
    isActive: true,
    startDate: new Date('2026-04-10T00:00:00.000Z'),
    endDate: new Date('2026-04-12T00:00:00.000Z'),
  };

  it('rechaza actualizar una actividad colgándola de un ciclo de otra unidad', async () => {
    const { service, events, user } = construir({
      ciclo: { ...cicloActivo, unitId: OTRA_UNIDAD },
    });
    events.findOne.mockResolvedValue(eventoActividad);

    await expect(
      service.update(
        user as never,
        'evento-1',
        {
          ...dtoReunion,
          kind: 'actividad',
          scope: 'grupo',
          cycleId: CICLO,
        } as never,
        HOY_DENTRO_DEL_CICLO,
      ),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });
});

describe('ProgramEventsService.update — cambio de ciclo desvincula oportunidades', () => {
  const OTRO_CICLO = '44444444-4444-4444-8444-444444444444';

  const eventoConOportunidades = {
    id: 'evento-1',
    unitId: UNIDAD,
    cycleId: CICLO,
    kind: 'reunion' as const,
    scope: 'rama' as const,
    isActive: true,
    startDate: new Date('2026-04-10T00:00:00.000Z'),
    endDate: new Date('2026-04-10T00:00:00.000Z'),
  };

  const otroCicloActivo = {
    ...cicloActivo,
    id: OTRO_CICLO,
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    endDate: new Date('2026-09-30T00:00:00.000Z'),
    activatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  it('cambiar el cycleId de un evento con oportunidades vinculadas las borra', async () => {
    const { service, events, cycles, links, user } = construir();
    events.findOne.mockResolvedValue(eventoConOportunidades);
    cycles.findOne.mockResolvedValue(otroCicloActivo);

    await service.update(
      user as never,
      'evento-1',
      {
        ...dtoReunion,
        cycleId: OTRO_CICLO,
        startDate: new Date('2026-07-10T00:00:00.000Z'),
        endDate: new Date('2026-07-10T00:00:00.000Z'),
      },
      HOY_DENTRO_DEL_CICLO,
    );

    expect(links.delete).toHaveBeenCalledWith({ programEventId: 'evento-1' });
  });

  it('un update que NO cambia el cycleId deja los vínculos intactos', async () => {
    const { service, events, links, user } = construir();
    events.findOne.mockResolvedValue(eventoConOportunidades);

    await service.update(
      user as never,
      'evento-1',
      {
        ...dtoReunion,
        cycleId: CICLO,
      },
      HOY_DENTRO_DEL_CICLO,
    );

    expect(links.delete).not.toHaveBeenCalled();
  });
});

describe('ProgramEventsService.reschedule', () => {
  const eventoGuardado = {
    id: 'evento-1',
    unitId: UNIDAD,
    cycleId: CICLO,
    kind: 'reunion' as const,
    scope: 'rama' as const,
    startDate: new Date('2026-04-10T00:00:00.000Z'),
    endDate: new Date('2026-04-10T00:00:00.000Z'),
    agenda: [] as { day: string }[],
    isActive: true,
  };

  it('mueve la fecha y no reporta conflictos cuando el día está libre', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue(eventoGuardado);
    events.find.mockResolvedValue([]);

    const resultado = await service.reschedule(
      user as never,
      'evento-1',
      {
        startDate: new Date('2026-04-17T00:00:00.000Z'),
        endDate: new Date('2026-04-17T00:00:00.000Z'),
      },
      HOY_DENTRO_DEL_CICLO,
    );

    expect(resultado.conflicts).toEqual([]);
    expect(events.save).toHaveBeenCalled();
  });

  it('reporta el solape con otro evento sin impedir el movimiento', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue(eventoGuardado);
    events.find.mockResolvedValue([
      {
        id: 'campamento-1',
        unitId: UNIDAD,
        kind: 'actividad',
        isActive: true,
        startDate: new Date('2026-04-16T00:00:00.000Z'),
        endDate: new Date('2026-04-18T00:00:00.000Z'),
      },
    ]);

    const resultado = await service.reschedule(
      user as never,
      'evento-1',
      {
        startDate: new Date('2026-04-17T00:00:00.000Z'),
        endDate: new Date('2026-04-17T00:00:00.000Z'),
      },
      HOY_DENTRO_DEL_CICLO,
    );

    expect(resultado.conflicts).toHaveLength(1);
    expect(resultado.conflicts[0].id).toBe('campamento-1');
  });

  it('rechaza mover una reunión fuera del rango del ciclo', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue(eventoGuardado);

    await expect(
      service.reschedule(user as never, 'evento-1', {
        startDate: new Date('2026-07-15T00:00:00.000Z'),
        endDate: new Date('2026-07-15T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  // H2: el arrastre solo validaba endDate >= startDate (en el DTO) y el rango
  // del ciclo (en el servicio). Nadie volvía a exigir la regla 1 (reunión de
  // un solo día) ni la regla 6 (agenda dentro del rango) al mover fechas, así
  // que el arrastre podía dejar el evento en un estado que ni siquiera pasa
  // createProgramEventSchema.
  it('rechaza reprogramar una reunión a un rango de varios días', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue(eventoGuardado);

    await expect(
      service.reschedule(
        user as never,
        'evento-1',
        {
          startDate: new Date('2026-04-17T00:00:00.000Z'),
          endDate: new Date('2026-04-21T00:00:00.000Z'),
        },
        HOY_DENTRO_DEL_CICLO,
      ),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  // Antes `reschedule` validaba la agenda contra
  // el rango NUEVO sin moverla — un momento sembrado con
  // `day = startDate` original (`seed.ts`, fe_ruta) quedaba clavado en la
  // fecha vieja apenas se guardaba una vez, y desde ahí CUALQUIER arrastre
  // de esa reunión se rechazaba para siempre, aunque el dirigente nunca
  // hubiera tocado la agenda. Esta prueba reproduce exactamente ese
  // escenario (un momento en el mismo día que `startDate`) y ahora exige
  // que el arreglo correcto sea MOVER el momento junto con el evento, no
  // rechazar el arrastre.
  it('reprogramar una reunión con un momento mueve el día del momento junto con el evento', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue({
      ...eventoGuardado,
      agenda: [{ day: '2026-04-10' }],
    });
    events.find.mockResolvedValue([]);

    const resultado = await service.reschedule(
      user as never,
      'evento-1',
      {
        startDate: new Date('2026-04-17T00:00:00.000Z'),
        endDate: new Date('2026-04-17T00:00:00.000Z'),
      },
      HOY_DENTRO_DEL_CICLO,
    );

    expect(resultado.conflicts).toEqual([]);
    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda: [expect.objectContaining({ day: '2026-04-17' })],
      }),
    );
  });

  // La otra mitad del arreglo: el desplazamiento no desactiva la
  // validación de rango, solo deja de dispararla por el caso en que la
  // respuesta obvia era mover. Si el rango se ACORTA, un momento puede
  // seguir quedando fuera después de desplazarse — y eso sigue
  // rechazándose igual que antes.
  it('reprogramar a un rango más corto que deja un momento fuera del rango desplazado sigue rechazando', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue({
      id: 'evento-3',
      unitId: UNIDAD,
      cycleId: null,
      kind: 'actividad' as const,
      scope: 'grupo' as const,
      // Campamento de 3 días con un momento en el ÚLTIMO día.
      startDate: new Date('2026-04-10T00:00:00.000Z'),
      endDate: new Date('2026-04-12T00:00:00.000Z'),
      agenda: [{ day: '2026-04-12' }],
      isActive: true,
    });

    await expect(
      service.reschedule(
        user as never,
        'evento-3',
        {
          // Delta +10 días, pero el rango destino es de un solo día: el
          // momento desplazado (04-12 + 10 = 04-22) cae fuera de
          // [04-20, 04-20].
          startDate: new Date('2026-04-20T00:00:00.000Z'),
          endDate: new Date('2026-04-20T00:00:00.000Z'),
        },
        HOY_DENTRO_DEL_CICLO,
      ),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('acepta reprogramar una reunión sin agenda a otro día válido del ciclo', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue(eventoGuardado);
    events.find.mockResolvedValue([]);

    const resultado = await service.reschedule(
      user as never,
      'evento-1',
      {
        startDate: new Date('2026-04-17T00:00:00.000Z'),
        endDate: new Date('2026-04-17T00:00:00.000Z'),
      },
      HOY_DENTRO_DEL_CICLO,
    );

    expect(events.save).toHaveBeenCalled();
    expect(resultado.conflicts).toEqual([]);
  });

  it('acepta reprogramar un campamento de 3 días a otros 3 días y desplaza su agenda el mismo delta', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue({
      id: 'evento-2',
      unitId: UNIDAD,
      cycleId: null,
      kind: 'actividad' as const,
      scope: 'grupo' as const,
      startDate: new Date('2026-04-10T00:00:00.000Z'),
      endDate: new Date('2026-04-12T00:00:00.000Z'),
      // El momento vive en el día DEL MEDIO del rango ORIGINAL — dentro de
      // [04-10, 04-12], como cualquier agenda real guardada. El arrastre
      // mueve el evento 10 días hacia adelante (04-10 → 04-20) y la agenda
      // se mueve CON él: el momento pasa de 04-11 a 04-21.
      agenda: [{ day: '2026-04-11' }],
      isActive: true,
    });
    events.find.mockResolvedValue([]);

    const resultado = await service.reschedule(
      user as never,
      'evento-2',
      {
        startDate: new Date('2026-04-20T00:00:00.000Z'),
        endDate: new Date('2026-04-22T00:00:00.000Z'),
      },
      HOY_DENTRO_DEL_CICLO,
    );

    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda: [expect.objectContaining({ day: '2026-04-21' })],
      }),
    );
    expect(resultado.conflicts).toEqual([]);
  });
});

describe('ProgramEventsService.setOpportunities', () => {
  const eventoGuardado = {
    id: 'evento-1',
    unitId: UNIDAD,
    cycleId: CICLO,
    kind: 'reunion' as const,
    isActive: true,
    startDate: new Date('2026-04-10T00:00:00.000Z'),
    endDate: new Date('2026-04-10T00:00:00.000Z'),
  };

  const planDiligenciado = {
    place: 'Salón principal',
    growthAreas: ['corporalidad'],
    competencies: {},
    observableBehaviours: ['llega puntual'],
    followUpTechniques: [],
  };

  it('vincula solo oportunidades seleccionadas del mismo ciclo', async () => {
    const { service, events, oportunidades, links, user } = construir();
    events.findOne.mockResolvedValue(eventoGuardado);
    oportunidades.find.mockResolvedValue([
      { id: 'oa-1', cycleId: CICLO, isSelected: true },
      { id: 'oa-2', cycleId: CICLO, isSelected: true },
    ]);

    await service.setOpportunities(user as never, 'evento-1', {
      opportunityIds: ['oa-1', 'oa-2'],
    });

    // No había vínculos previos: no hay nada que borrar, todo se crea de cero.
    expect(links.delete).not.toHaveBeenCalled();
    expect(links.save).toHaveBeenCalledWith([
      expect.objectContaining({ learningOpportunityId: 'oa-1', position: 0 }),
      expect.objectContaining({ learningOpportunityId: 'oa-2', position: 1 }),
    ]);
  });

  it('rechaza vincular una oportunidad no seleccionada', async () => {
    const { service, events, oportunidades, user } = construir();
    events.findOne.mockResolvedValue(eventoGuardado);
    oportunidades.find.mockResolvedValue([
      { id: 'oa-1', cycleId: CICLO, isSelected: false },
    ]);

    await expect(
      service.setOpportunities(user as never, 'evento-1', {
        opportunityIds: ['oa-1'],
      }),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('rechaza dejar una reunión sin ninguna oportunidad', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue(eventoGuardado);

    await expect(
      service.setOpportunities(user as never, 'evento-1', {
        opportunityIds: [],
      }),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('permite dejar una actividad sin oportunidades', async () => {
    const { service, events, links, user } = construir();
    events.findOne.mockResolvedValue({
      ...eventoGuardado,
      kind: 'actividad',
      cycleId: null,
    });
    links.find.mockResolvedValue([
      {
        id: 'link-x',
        programEventId: 'evento-1',
        learningOpportunityId: 'oa-x',
        position: 0,
        plan: null,
      },
    ]);

    await service.setOpportunities(user as never, 'evento-1', {
      opportunityIds: [],
    });

    expect(links.delete).toHaveBeenCalledWith({ id: In(['link-x']) });
  });

  it('conserva el plan ya diligenciado de una oportunidad que sigue vinculada al agregar una nueva', async () => {
    const { service, events, oportunidades, links, user } = construir();
    events.findOne.mockResolvedValue(eventoGuardado);
    links.find.mockResolvedValue([
      {
        id: 'link-1',
        programEventId: 'evento-1',
        learningOpportunityId: 'oa-1',
        position: 0,
        plan: planDiligenciado,
      },
      {
        id: 'link-2',
        programEventId: 'evento-1',
        learningOpportunityId: 'oa-2',
        position: 1,
        plan: null,
      },
    ]);
    oportunidades.find.mockResolvedValue([
      { id: 'oa-1', cycleId: CICLO, isSelected: true },
      { id: 'oa-2', cycleId: CICLO, isSelected: true },
      { id: 'oa-3', cycleId: CICLO, isSelected: true },
    ]);

    const resultado = await service.setOpportunities(
      user as never,
      'evento-1',
      { opportunityIds: ['oa-1', 'oa-2', 'oa-3'] },
    );

    const oa1 = resultado.find((link) => link.learningOpportunityId === 'oa-1');
    expect(oa1?.plan).toEqual(planDiligenciado);
  });

  it('reordenar actualiza la posición y conserva los planes de todas', async () => {
    const { service, events, oportunidades, links, user } = construir();
    events.findOne.mockResolvedValue(eventoGuardado);
    const planB = { ...planDiligenciado, place: 'Cancha' };
    links.find.mockResolvedValue([
      {
        id: 'link-1',
        programEventId: 'evento-1',
        learningOpportunityId: 'oa-1',
        position: 0,
        plan: planDiligenciado,
      },
      {
        id: 'link-2',
        programEventId: 'evento-1',
        learningOpportunityId: 'oa-2',
        position: 1,
        plan: planB,
      },
    ]);
    oportunidades.find.mockResolvedValue([
      { id: 'oa-1', cycleId: CICLO, isSelected: true },
      { id: 'oa-2', cycleId: CICLO, isSelected: true },
    ]);

    // Reordenado: oa-2 pasa a ser la primera.
    const resultado = await service.setOpportunities(
      user as never,
      'evento-1',
      { opportunityIds: ['oa-2', 'oa-1'] },
    );

    const oa1 = resultado.find((link) => link.learningOpportunityId === 'oa-1');
    const oa2 = resultado.find((link) => link.learningOpportunityId === 'oa-2');
    expect(oa2?.position).toBe(0);
    expect(oa1?.position).toBe(1);
    expect(oa1?.plan).toEqual(planDiligenciado);
    expect(oa2?.plan).toEqual(planB);
  });

  it('quitar una oportunidad borra solo su vínculo y conserva el plan de las demás', async () => {
    const { service, events, oportunidades, links, user } = construir();
    events.findOne.mockResolvedValue(eventoGuardado);
    links.find.mockResolvedValue([
      {
        id: 'link-1',
        programEventId: 'evento-1',
        learningOpportunityId: 'oa-1',
        position: 0,
        plan: planDiligenciado,
      },
      {
        id: 'link-2',
        programEventId: 'evento-1',
        learningOpportunityId: 'oa-2',
        position: 1,
        plan: null,
      },
    ]);
    oportunidades.find.mockResolvedValue([
      { id: 'oa-1', cycleId: CICLO, isSelected: true },
    ]);

    const resultado = await service.setOpportunities(
      user as never,
      'evento-1',
      { opportunityIds: ['oa-1'] },
    );

    expect(links.delete).toHaveBeenCalledWith({ id: In(['link-2']) });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].learningOpportunityId).toBe('oa-1');
    expect(resultado[0].plan).toEqual(planDiligenciado);
  });

  it('rechaza vincular a un evento con ciclo una oportunidad seleccionada de otro ciclo', async () => {
    const { service, events, oportunidades, user } = construir();
    events.findOne.mockResolvedValue(eventoGuardado);
    oportunidades.find.mockResolvedValue([
      { id: 'oa-otro-ciclo', cycleId: 'otro-ciclo', isSelected: true },
    ]);

    await expect(
      service.setOpportunities(user as never, 'evento-1', {
        opportunityIds: ['oa-otro-ciclo'],
      }),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('rechaza en una actividad sin ciclo mezclar oportunidades de dos ciclos distintos', async () => {
    const { service, events, oportunidades, user } = construir();
    events.findOne.mockResolvedValue({
      ...eventoGuardado,
      kind: 'actividad',
      cycleId: null,
    });
    oportunidades.find.mockResolvedValue([
      { id: 'oa-1', cycleId: 'ciclo-a', isSelected: true },
      { id: 'oa-2', cycleId: 'ciclo-b', isSelected: true },
    ]);

    await expect(
      service.setOpportunities(user as never, 'evento-1', {
        opportunityIds: ['oa-1', 'oa-2'],
      }),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('rechaza en una actividad sin ciclo vincular oportunidades de un ciclo fuera del alcance del actor', async () => {
    const { service, events, oportunidades, user } = construir({
      ciclo: { ...cicloActivo, unitId: OTRA_UNIDAD },
    });
    events.findOne.mockResolvedValue({
      ...eventoGuardado,
      kind: 'actividad',
      cycleId: null,
    });
    oportunidades.find.mockResolvedValue([
      { id: 'oa-1', cycleId: CICLO, isSelected: true },
    ]);

    await expect(
      service.setOpportunities(user as never, 'evento-1', {
        opportunityIds: ['oa-1'],
      }),
    ).rejects.toBeInstanceOf(AppForbiddenException);
  });

  it('rechaza setOpportunities sobre una actividad con cycleId ajeno por alcance', async () => {
    // H1: `validarCicloDeOportunidades` solo comprobaba alcance en la rama de
    // ciclo nulo. Una actividad con `evento.cycleId` de otra unidad aceptaba
    // sus oportunidades sin más porque esa rama hacía `return` antes de
    // consultar la unidad del ciclo.
    const { service, events, oportunidades, user } = construir({
      ciclo: { ...cicloActivo, unitId: OTRA_UNIDAD },
    });
    events.findOne.mockResolvedValue({
      ...eventoGuardado,
      kind: 'actividad',
      cycleId: CICLO,
    });
    oportunidades.find.mockResolvedValue([
      { id: 'oa-1', cycleId: CICLO, isSelected: true },
    ]);

    await expect(
      service.setOpportunities(user as never, 'evento-1', {
        opportunityIds: ['oa-1'],
      }),
    ).rejects.toBeInstanceOf(AppForbiddenException);
  });

  it('permite en una actividad sin ciclo vincular oportunidades de un único ciclo alcanzable', async () => {
    const { service, events, oportunidades, links, user } = construir();
    events.findOne.mockResolvedValue({
      ...eventoGuardado,
      kind: 'actividad',
      cycleId: null,
    });
    oportunidades.find.mockResolvedValue([
      { id: 'oa-1', cycleId: CICLO, isSelected: true },
    ]);

    await service.setOpportunities(user as never, 'evento-1', {
      opportunityIds: ['oa-1'],
    });

    expect(links.save).toHaveBeenCalled();
  });
});

describe('ProgramEventsService.findAll', () => {
  it('no devuelve eventos de una unidad fuera del alcance del actor', async () => {
    const { service, events, unitsService, user } = construir();
    unitsService.findAll.mockResolvedValue([
      { id: UNIDAD },
      { id: OTRA_UNIDAD },
    ]);
    const eventosEnBase = [
      { id: 'evento-alcanzable', unitId: UNIDAD },
      { id: 'evento-ajeno', unitId: 'unidad-sin-acceso' },
    ];
    // El doble simula el filtrado que en producción hace la base de datos vía
    // el `where.unitId: In(alcanzables)`: así la prueba verifica el resultado,
    // no solo que se construyó el filtro.
    events.find.mockImplementation(
      ({ where }: { where: { unitId: { value: string[] } } }) =>
        Promise.resolve(
          eventosEnBase.filter((evento) =>
            where.unitId.value.includes(evento.unitId),
          ),
        ),
    );

    const resultado = await service.findAll(user as never, {});

    expect(resultado).toEqual([{ id: 'evento-alcanzable', unitId: UNIDAD }]);
  });

  // Sin `relations: { opportunities: true }`, la
  // misma reunión completa medía 100 % en el formulario (`findOne`, que sí
  // trae la relación) y 80 % en la tarjeta de la columna (`findAll`) — dos
  // formas de dato distintas del mismo evento, no dos criterios. `findAll`
  // debe pedir la MISMA relación que `findOne` para que ambos endpoints
  // devuelvan la misma forma.
  it('carga la relación `opportunities`, igual que `findOne`', async () => {
    const { service, events, user } = construir();

    await service.findAll(user as never, {});

    expect(events.find).toHaveBeenCalledWith(
      expect.objectContaining({ relations: { opportunities: true } }),
    );
  });
});

describe('ProgramEventsService.findOne', () => {
  it('lanza si el evento pertenece a una unidad fuera del alcance del actor', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue({
      id: 'evento-1',
      unitId: 'unidad-sin-acceso',
      isActive: true,
    });

    await expect(
      service.findOne(user as never, 'evento-1'),
    ).rejects.toBeInstanceOf(AppForbiddenException);
  });
});

describe('ProgramEventsService.saveEvaluation', () => {
  const eventoTerminado = {
    id: 'evento-1',
    unitId: UNIDAD,
    kind: 'reunion' as const,
    isActive: true,
    startDate: new Date('2026-04-10T00:00:00.000Z'),
    endDate: new Date('2026-04-10T00:00:00.000Z'),
  };

  const evaluacion = {
    summary: 'La reunión salió bien',
    recordedAt: '2026-04-11T10:00:00.000Z',
  };

  it('guarda la evaluación cuando el evento ya terminó', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue(eventoTerminado);

    await service.saveEvaluation(
      user as never,
      'evento-1',
      evaluacion,
      new Date('2026-04-11T00:00:00.000Z'),
    );

    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({ evaluation: evaluacion }),
    );
  });

  it('rechaza evaluar el mismo día del evento', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue(eventoTerminado);

    await expect(
      service.saveEvaluation(
        user as never,
        'evento-1',
        evaluacion,
        new Date('2026-04-10T00:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });

  it('rechaza evaluar antes del evento', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue(eventoTerminado);

    await expect(
      service.saveEvaluation(
        user as never,
        'evento-1',
        evaluacion,
        new Date('2026-04-01T00:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(AppBadRequestException);
  });
});

// H3: el índice único parcial `UX_program_events_reunion_fecha` (regla 3)
// funciona en la base, pero el `QueryFailedError` que Postgres devuelve no es
// una `HttpException`: el filtro global lo convertía en 500 con
// COMMON.INTERNAL_ERROR. `EVENTS.DATE_TAKEN` existe en el catálogo y en
// `apiErrorCodes` precisamente para que el frontend pueda distinguirlo y
// revertir la tarjeta arrastrada, pero nunca se emitía.
describe('ProgramEventsService — H3 violación de unicidad como DATE_TAKEN', () => {
  it('create traduce el error 23505 de events.save a AppConflictException', async () => {
    const { service, events, user } = construir();
    events.save.mockRejectedValue(ERROR_UNICIDAD);

    await expect(
      service.create(user as never, dtoReunion, HOY_DENTRO_DEL_CICLO),
    ).rejects.toBeInstanceOf(AppConflictException);
  });

  it('update traduce el error 23505 de events.save a AppConflictException', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue({
      id: 'evento-1',
      unitId: UNIDAD,
      cycleId: CICLO,
      kind: 'reunion' as const,
      scope: 'rama' as const,
      isActive: true,
      startDate: new Date('2026-04-10T00:00:00.000Z'),
      endDate: new Date('2026-04-10T00:00:00.000Z'),
    });
    events.save.mockRejectedValue(ERROR_UNICIDAD);

    await expect(
      service.update(
        user as never,
        'evento-1',
        dtoReunion,
        HOY_DENTRO_DEL_CICLO,
      ),
    ).rejects.toBeInstanceOf(AppConflictException);
  });

  it('reschedule traduce el error 23505 de events.save a AppConflictException', async () => {
    const { service, events, user } = construir();
    events.findOne.mockResolvedValue({
      id: 'evento-1',
      unitId: UNIDAD,
      cycleId: CICLO,
      kind: 'reunion' as const,
      scope: 'rama' as const,
      isActive: true,
      agenda: [] as { day: string }[],
      startDate: new Date('2026-04-10T00:00:00.000Z'),
      endDate: new Date('2026-04-10T00:00:00.000Z'),
    });
    events.save.mockRejectedValue(ERROR_UNICIDAD);

    await expect(
      service.reschedule(
        user as never,
        'evento-1',
        {
          startDate: new Date('2026-04-17T00:00:00.000Z'),
          endDate: new Date('2026-04-17T00:00:00.000Z'),
        },
        HOY_DENTRO_DEL_CICLO,
      ),
    ).rejects.toBeInstanceOf(AppConflictException);
  });
});

// H6: la regla 11 (nadie planea por encima de su nivel) solo se comprobaba
// en create y update — y en update, solo contra el scope ENTRANTE
// (dto.scope), nunca contra el que el evento YA tiene. Un actor de rango
// 'rama' con permiso event:update/event:delete podía borrar, arrastrar o
// degradar un evento de alcance 'grupo' que él mismo nunca habría podido
// crear.
describe('ProgramEventsService — H6 alcance protege TODAS las puertas', () => {
  const eventoAlcanceGrupo = {
    id: 'evento-grupo',
    unitId: UNIDAD,
    cycleId: null,
    kind: 'actividad' as const,
    scope: 'grupo' as const,
    isActive: true,
    agenda: [] as { day: string }[],
    participatingUnitIds: [] as string[],
    startDate: new Date('2026-04-10T00:00:00.000Z'),
    endDate: new Date('2026-04-12T00:00:00.000Z'),
  };

  it('remove: rechaza a un actor de rama sobre un evento de alcance grupo', async () => {
    const { service, events, user } = construir({ nivel: 'rama' });
    events.findOne.mockResolvedValue(eventoAlcanceGrupo);

    await expect(
      service.remove(user as never, 'evento-grupo'),
    ).rejects.toBeInstanceOf(AppForbiddenException);
  });

  it('remove: acepta a un actor de grupo sobre el mismo evento', async () => {
    const { service, events, user } = construir({ nivel: 'grupo' });
    events.findOne.mockResolvedValue(eventoAlcanceGrupo);

    await service.remove(user as never, 'evento-grupo');

    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
  });

  it('reschedule: rechaza a un actor de rama sobre un evento de alcance grupo', async () => {
    const { service, events, user } = construir({ nivel: 'rama' });
    events.findOne.mockResolvedValue(eventoAlcanceGrupo);

    await expect(
      service.reschedule(user as never, 'evento-grupo', {
        startDate: new Date('2026-04-20T00:00:00.000Z'),
        endDate: new Date('2026-04-22T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(AppForbiddenException);
  });

  it('reschedule: acepta a un actor de grupo sobre el mismo evento', async () => {
    const { service, events, user } = construir({ nivel: 'grupo' });
    events.findOne.mockResolvedValue(eventoAlcanceGrupo);
    events.find.mockResolvedValue([]);

    const resultado = await service.reschedule(user as never, 'evento-grupo', {
      startDate: new Date('2026-04-20T00:00:00.000Z'),
      endDate: new Date('2026-04-22T00:00:00.000Z'),
    });

    expect(resultado.conflicts).toEqual([]);
  });

  it('update: rechaza a un actor de rama que intenta degradar a rama un evento de alcance grupo', async () => {
    // El bug real: canUseScope(user, dto.scope) con dto.scope = 'rama' pasa
    // (un actor de rama puede usar el alcance 'rama'), así que la degradación
    // se colaba sin nunca mirar que el evento YA era de alcance 'grupo'.
    const { service, events, user } = construir({ nivel: 'rama' });
    events.findOne.mockResolvedValue(eventoAlcanceGrupo);

    await expect(
      service.update(user as never, 'evento-grupo', {
        ...dtoReunion,
        kind: 'actividad',
        scope: 'rama',
        cycleId: undefined,
      } as never),
    ).rejects.toBeInstanceOf(AppForbiddenException);
  });

  it('update: acepta a un actor de grupo editar el mismo evento', async () => {
    const { service, events, user } = construir({ nivel: 'grupo' });
    events.findOne.mockResolvedValue(eventoAlcanceGrupo);

    await service.update(user as never, 'evento-grupo', {
      ...dtoReunion,
      kind: 'actividad',
      scope: 'grupo',
      cycleId: undefined,
    } as never);

    expect(events.save).toHaveBeenCalled();
  });

  it('setOpportunities: rechaza a un actor de rama sobre un evento de alcance grupo', async () => {
    const { service, events, user } = construir({ nivel: 'rama' });
    events.findOne.mockResolvedValue(eventoAlcanceGrupo);

    await expect(
      service.setOpportunities(user as never, 'evento-grupo', {
        opportunityIds: [],
      }),
    ).rejects.toBeInstanceOf(AppForbiddenException);
  });

  it('saveOpportunityPlan: rechaza a un actor de rama sobre un evento de alcance grupo', async () => {
    const { service, events, user } = construir({ nivel: 'rama' });
    events.findOne.mockResolvedValue(eventoAlcanceGrupo);

    await expect(
      service.saveOpportunityPlan(user as never, 'evento-grupo', 'oa-1', {
        growthAreas: [],
        competencies: {},
        observableBehaviours: [],
        followUpTechniques: [],
      }),
    ).rejects.toBeInstanceOf(AppForbiddenException);
  });

  it('saveEvaluation: rechaza a un actor de rama sobre un evento de alcance grupo', async () => {
    const { service, events, user } = construir({ nivel: 'rama' });
    events.findOne.mockResolvedValue(eventoAlcanceGrupo);

    await expect(
      service.saveEvaluation(
        user as never,
        'evento-grupo',
        {
          summary: 'La actividad salió bien',
          recordedAt: '2026-04-13T10:00:00.000Z',
        },
        new Date('2026-04-13T00:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(AppForbiddenException);
  });
});
