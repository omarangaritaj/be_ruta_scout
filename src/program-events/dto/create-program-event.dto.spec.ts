import { createProgramEventSchema } from './create-program-event.dto';

const safeguardingCompleto = {
  buttonReady: true,
  buttonReachable: true,
  usageKnown: true,
  inclusionAdjustment: false,
};

const reunionBase = {
  kind: 'reunion' as const,
  unitId: '11111111-1111-4111-8111-111111111111',
  cycleId: '22222222-2222-4222-8222-222222222222',
  scope: 'rama' as const,
  name: 'Rastreo en el bosque',
  startDate: '2026-08-18',
  endDate: '2026-08-18',
  place: 'Parque El Salitre',
  safeguarding: safeguardingCompleto,
  riskManagement: { checks: [true, true, true, true], risks: [] },
};

describe('createProgramEventSchema', () => {
  it('acepta una reunión de un solo día', () => {
    expect(createProgramEventSchema.safeParse(reunionBase).success).toBe(true);
  });

  it('rechaza una reunión de varios días', () => {
    const resultado = createProgramEventSchema.safeParse({
      ...reunionBase,
      endDate: '2026-08-20',
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza una reunión sin ciclo', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se extrae para omitirla del objeto
    const { cycleId, ...sinCiclo } = reunionBase;
    expect(createProgramEventSchema.safeParse(sinCiclo).success).toBe(false);
  });

  it('rechaza una reunión con alcance distinto de rama', () => {
    const resultado = createProgramEventSchema.safeParse({
      ...reunionBase,
      scope: 'grupo',
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza cuando falta una respuesta de A Salvo del Peligro', () => {
    const resultado = createProgramEventSchema.safeParse({
      ...reunionBase,
      safeguarding: { ...safeguardingCompleto, usageKnown: null },
    });
    expect(resultado.success).toBe(false);
  });

  it('acepta que una respuesta obligatoria sea no', () => {
    const resultado = createProgramEventSchema.safeParse({
      ...reunionBase,
      safeguarding: { ...safeguardingCompleto, buttonReady: false },
    });
    expect(resultado.success).toBe(true);
  });

  it('acepta una actividad de varios días sin ciclo', () => {
    const resultado = createProgramEventSchema.safeParse({
      kind: 'actividad',
      unitId: '11111111-1111-4111-8111-111111111111',
      scope: 'grupo',
      name: 'Campamento de grupo',
      startDate: '2026-09-12',
      endDate: '2026-09-14',
      place: 'Finca La Esperanza',
      safeguarding: safeguardingCompleto,
      riskManagement: { checks: [true, true, true, true], risks: [] },
    });
    expect(resultado.success).toBe(true);
  });

  it('rechaza un rango invertido', () => {
    const resultado = createProgramEventSchema.safeParse({
      kind: 'actividad',
      unitId: '11111111-1111-4111-8111-111111111111',
      scope: 'grupo',
      name: 'Campamento de grupo',
      startDate: '2026-09-14',
      endDate: '2026-09-12',
      place: 'Finca La Esperanza',
      safeguarding: safeguardingCompleto,
      riskManagement: { checks: [true, true, true, true], risks: [] },
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza un momento de agenda fuera del rango', () => {
    const resultado = createProgramEventSchema.safeParse({
      ...reunionBase,
      agenda: [
        {
          day: '2026-08-19',
          startTime: '14:00',
          title: 'Apertura',
          description: 'Consejo de la roca',
        },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza un momento de agenda con un día que no existe en el calendario', () => {
    const resultado = createProgramEventSchema.safeParse({
      kind: 'actividad',
      unitId: '11111111-1111-4111-8111-111111111111',
      scope: 'grupo',
      name: 'Campamento de grupo',
      startDate: '2026-02-25',
      endDate: '2026-03-05',
      place: 'Finca La Esperanza',
      safeguarding: safeguardingCompleto,
      riskManagement: { checks: [true, true, true, true], risks: [] },
      agenda: [
        {
          day: '2026-02-30',
          startTime: '08:00',
          title: 'Izada',
          description: 'Día inexistente',
        },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it('acepta momentos dentro del rango de una actividad de varios días', () => {
    const resultado = createProgramEventSchema.safeParse({
      kind: 'actividad',
      unitId: '11111111-1111-4111-8111-111111111111',
      scope: 'grupo',
      name: 'Campamento de grupo',
      startDate: '2026-09-12',
      endDate: '2026-09-14',
      place: 'Finca La Esperanza',
      safeguarding: safeguardingCompleto,
      riskManagement: { checks: [true, true, true, true], risks: [] },
      agenda: [
        {
          day: '2026-09-13',
          startTime: '08:00',
          title: 'Izada',
          description: 'Apertura del segundo día',
        },
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('rechaza unidades participantes en un evento de alcance rama', () => {
    const resultado = createProgramEventSchema.safeParse({
      ...reunionBase,
      participatingUnitIds: ['33333333-3333-4333-8333-333333333333'],
    });
    expect(resultado.success).toBe(false);
  });

  it('acepta unidades participantes en una actividad de grupo', () => {
    const resultado = createProgramEventSchema.safeParse({
      kind: 'actividad',
      unitId: '11111111-1111-4111-8111-111111111111',
      scope: 'grupo',
      name: 'Campamento de grupo',
      startDate: '2026-09-12',
      endDate: '2026-09-14',
      place: 'Finca La Esperanza',
      safeguarding: safeguardingCompleto,
      riskManagement: { checks: [true, true, true, true], risks: [] },
      participatingUnitIds: ['33333333-3333-4333-8333-333333333333'],
    });
    expect(resultado.success).toBe(true);
  });

  // Borradores: el formulario del frontend guarda con el mismo esquema
  // mientras el evento está incompleto, así que las filas de las cuatro
  // tablas (agenda, riesgos, equipo adulto, materiales) deben aceptar texto
  // vacío. La clave sigue siendo obligatoria, solo el contenido deja de serlo.
  describe('borradores: filas de tabla vacías', () => {
    it('acepta un momento de agenda con título y descripción vacíos', () => {
      const resultado = createProgramEventSchema.safeParse({
        ...reunionBase,
        agenda: [
          {
            day: '2026-08-18',
            startTime: '14:00',
            title: '',
            description: '',
          },
        ],
      });
      expect(resultado.success).toBe(true);
    });

    it('acepta un riesgo con peligro, riesgo y controles vacíos', () => {
      const resultado = createProgramEventSchema.safeParse({
        ...reunionBase,
        riskManagement: {
          checks: [true, true, true, true],
          risks: [
            {
              hazard: '',
              risk: '',
              type: 'fisico',
              probability: 1,
              consequence: 1,
              controls: '',
            },
          ],
        },
      });
      expect(resultado.success).toBe(true);
    });

    it('acepta un integrante del equipo adulto con nombre, rol y teléfono vacíos', () => {
      const resultado = createProgramEventSchema.safeParse({
        ...reunionBase,
        adultTeam: [{ internal: true, name: '', role: '', phone: '' }],
      });
      expect(resultado.success).toBe(true);
    });

    it('acepta un material con nombre vacío', () => {
      const resultado = createProgramEventSchema.safeParse({
        ...reunionBase,
        materials: [{ name: '' }],
      });
      expect(resultado.success).toBe(true);
    });
  });

  // Contraparte obligatoria: un borrador acepta filas vacías, pero NO deja de
  // validar la identidad del evento ni las invariantes de reglas de negocio.
  // Si alguna de estas empieza a pasar, el cambio de arriba se relajó de más.
  describe('borradores: lo que sigue rechazándose', () => {
    it('rechaza un evento con name vacío', () => {
      const resultado = createProgramEventSchema.safeParse({
        ...reunionBase,
        name: '',
      });
      expect(resultado.success).toBe(false);
    });

    it('rechaza un evento con place vacío', () => {
      const resultado = createProgramEventSchema.safeParse({
        ...reunionBase,
        place: '',
      });
      expect(resultado.success).toBe(false);
    });

    it('rechaza un momento de agenda con un day fuera del rango del evento', () => {
      const resultado = createProgramEventSchema.safeParse({
        ...reunionBase,
        agenda: [
          {
            day: '2026-08-19',
            startTime: '14:00',
            title: '',
            description: '',
          },
        ],
      });
      expect(resultado.success).toBe(false);
    });

    it('rechaza una reunión con startDate distinto de endDate', () => {
      const resultado = createProgramEventSchema.safeParse({
        ...reunionBase,
        endDate: '2026-08-20',
      });
      expect(resultado.success).toBe(false);
    });

    it('rechaza un evento con endDate anterior a startDate', () => {
      const resultado = createProgramEventSchema.safeParse({
        kind: 'actividad',
        unitId: '11111111-1111-4111-8111-111111111111',
        scope: 'grupo',
        name: 'Campamento de grupo',
        startDate: '2026-09-14',
        endDate: '2026-09-12',
        place: 'Finca La Esperanza',
        safeguarding: safeguardingCompleto,
        riskManagement: { checks: [true, true, true, true], risks: [] },
      });
      expect(resultado.success).toBe(false);
    });

    it('rechaza una reunión con alcance distinto de rama', () => {
      const resultado = createProgramEventSchema.safeParse({
        ...reunionBase,
        scope: 'grupo',
      });
      expect(resultado.success).toBe(false);
    });
  });
});
