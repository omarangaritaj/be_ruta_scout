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
      skipped: 'no-people',
    });
  });

  it('sin adultos no puede haber jefe y no siembra', () => {
    expect(planGroupSeed({ groupId: 304, people: [cub] })).toEqual({
      units: [],
      skipped: 'no-adults',
    });
  });

  it('sin protagonistas no hay unidad que crear', () => {
    expect(planGroupSeed({ groupId: 304, people: [chief] })).toEqual({
      units: [],
      skipped: 'no-protagonists',
    });
  });
});
