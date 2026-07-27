import { planGroupSeed } from './unit-seeder';

const chief = {
  _id: 'a1',
  name: 'Zulema Ruiz',
  tipo: 'adulto' as const,
  cargoSiscout: 'JEFE DE MANADA',
  districtId: 12,
  districtName: 'Distrito Norte',
};
const cub = {
  _id: 'p1',
  name: 'Ana Ruiz',
  tipo: 'protagonista' as const,
  cargoSiscout: 'LOBATO',
};
const cub2 = {
  _id: 'p2',
  name: 'Beto Paz',
  tipo: 'protagonista' as const,
  cargoSiscout: 'LOBATOS',
};
const scout = {
  _id: 'p3',
  name: 'Cesar Mora',
  tipo: 'protagonista' as const,
  cargoSiscout: 'SCOUT',
};

describe('planGroupSeed', () => {
  it('crea una unidad por rama con protagonistas', () => {
    const plan = planGroupSeed({
      groupId: 304,
      people: [chief, cub, cub2, scout],
    });
    expect(plan.units).toHaveLength(2);
    expect(plan.units.map((u) => u.branch).sort()).toEqual(['manada', 'tropa']);
  });

  it('agrupa a los protagonistas de la misma rama pese a los alias', () => {
    const plan = planGroupSeed({ groupId: 304, people: [chief, cub, cub2] });
    expect(plan.units[0].members.sort()).toEqual(['p1', 'p2']);
  });

  it('nombra la unidad con el texto de cambio pendiente', () => {
    const plan = planGroupSeed({ groupId: 304, people: [chief, cub] });
    expect(plan.units[0].name).toBe('cambiar nombre unidad manada');
  });

  it('hereda el distrito del primer usuario que lo tenga', () => {
    const plan = planGroupSeed({ groupId: 304, people: [chief, cub] });
    expect(plan.units[0].districtId).toBe(12);
    expect(plan.units[0].districtName).toBe('Distrito Norte');
  });

  it('asigna el jefe de rama a su unidad', () => {
    const plan = planGroupSeed({ groupId: 304, people: [chief, cub, scout] });
    const pack = plan.units.find((u) => u.branch === 'manada');
    expect(pack?.unitLeaderId).toBe('a1');
  });

  it('cae al jefe de grupo en la rama que no tiene jefatura propia', () => {
    const plan = planGroupSeed({ groupId: 304, people: [chief, cub, scout] });
    const troop = plan.units.find((u) => u.branch === 'tropa');
    expect(troop?.unitLeaderId).toBe('a1');
  });

  it('nace sin subjefes', () => {
    const plan = planGroupSeed({ groupId: 304, people: [chief, cub] });
    expect(plan.units[0].leaders).toEqual([]);
  });

  it('sin personas no siembra', () => {
    expect(planGroupSeed({ groupId: 304, people: [] })).toEqual({
      units: [],
      discarded: [],
      skipped: 'no-people',
    });
  });

  it('sin adultos no puede haber jefe y no siembra', () => {
    expect(planGroupSeed({ groupId: 304, people: [cub] })).toEqual({
      units: [],
      discarded: [],
      skipped: 'no-adults',
    });
  });

  it('sin protagonistas no hay unidad que crear', () => {
    expect(planGroupSeed({ groupId: 304, people: [chief] })).toEqual({
      units: [],
      discarded: [],
      skipped: 'no-protagonists',
    });
  });

  describe('protagonistas sin rama legible', () => {
    const stray = {
      _id: 'p9',
      name: 'Iván Soto',
      tipo: 'protagonista' as const,
      cargoSiscout: 'LoBaToS  DE  ALGO RARO',
    };

    it('no los mete en ninguna unidad', () => {
      const plan = planGroupSeed({
        groupId: 304,
        people: [chief, cub, stray],
      });
      const everyone = plan.units.flatMap((u) => u.members);
      expect(everyone).not.toContain('p9');
    });

    it('los reporta con el cargoSiscout literal, sin normalizar', () => {
      const plan = planGroupSeed({
        groupId: 304,
        people: [chief, cub, stray],
      });
      expect(plan.discarded).toEqual([
        {
          _id: 'p9',
          name: 'Iván Soto',
          cargoSiscout: 'LoBaToS  DE  ALGO RARO',
        },
      ]);
    });

    it('reporta también a quien no trae cargoSiscout alguno', () => {
      const plan = planGroupSeed({
        groupId: 304,
        people: [
          chief,
          cub,
          { _id: 'p8', name: 'Sin Cargo', tipo: 'protagonista' as const },
        ],
      });
      expect(plan.discarded).toEqual([
        { _id: 'p8', name: 'Sin Cargo', cargoSiscout: undefined },
      ]);
    });

    it('los reporta aunque el grupo no tenga ningún adulto', () => {
      const plan = planGroupSeed({ groupId: 304, people: [stray] });
      expect(plan.skipped).toBe('no-adults');
      expect(plan.discarded).toHaveLength(1);
    });

    it('un grupo cuyos protagonistas son todos ilegibles no genera unidades', () => {
      const plan = planGroupSeed({ groupId: 304, people: [chief, stray] });
      expect(plan.units).toEqual([]);
      expect(plan.skipped).toBe('no-protagonists');
      expect(plan.discarded).toHaveLength(1);
    });
  });
});
