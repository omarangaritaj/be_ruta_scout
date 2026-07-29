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

  describe('jefatura que nace con la unidad', () => {
    const deputy = {
      _id: 'a7',
      name: 'Aaron Paz',
      tipo: 'adulto' as const,
      cargoSiscout: 'SUB-JEFE DE MANADA',
    };
    const troopChief = {
      _id: 'a8',
      name: 'Elsa Mora',
      tipo: 'adulto' as const,
      cargoSiscout: 'JEFE DE TROPA',
    };

    it('suma a los subjefes de la rama como leaders', () => {
      const plan = planGroupSeed({
        groupId: 304,
        people: [chief, deputy, cub],
      });
      expect(plan.units[0].unitLeaderId).toBe('a1');
      expect(plan.units[0].leaders).toEqual(['a7']);
    });

    it('no repite al jefe de unidad dentro de los subjefes', () => {
      const plan = planGroupSeed({ groupId: 304, people: [deputy, cub] });
      expect(plan.units[0].unitLeaderId).toBe('a7');
      expect(plan.units[0].leaders).toEqual([]);
    });

    it('no arrastra la jefatura de otra rama', () => {
      const plan = planGroupSeed({
        groupId: 304,
        people: [chief, deputy, troopChief, cub, scout],
      });
      const pack = plan.units.find((u) => u.branch === 'manada');
      const troop = plan.units.find((u) => u.branch === 'tropa');
      expect(pack?.leaders).toEqual(['a7']);
      expect(troop?.unitLeaderId).toBe('a8');
      expect(troop?.leaders).toEqual([]);
    });

    it('sin jefatura propia la unidad nace sin subjefes', () => {
      const groupChief = {
        _id: 'a2',
        name: 'Bruno Diaz',
        tipo: 'adulto' as const,
        cargoSiscout: 'JEFE DE GRUPO',
      };
      const plan = planGroupSeed({ groupId: 304, people: [groupChief, cub] });
      expect(plan.units[0].unitLeaderId).toBe('a2');
      expect(plan.units[0].leaders).toEqual([]);
    });
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

    it('reporta la edad junto al cargo, para poder diagnosticar por qué falló', () => {
      const plan = planGroupSeed({
        groupId: 304,
        people: [chief, cub, { ...stray, age: 40 }],
      });
      expect(plan.discarded).toEqual([
        {
          _id: 'p9',
          name: 'Iván Soto',
          cargoSiscout: 'LoBaToS  DE  ALGO RARO',
          age: 40,
        },
      ]);
    });
  });

  /**
   * SiScout guarda la rama del protagonista en `cargo`, pero se la pisa con el
   * cargo de responsabilidad juvenil en cuanto tiene uno. Sin este respaldo,
   * los guías de patrulla y presidentes de clan —los más comprometidos de su
   * unidad— eran justo los que se quedaban sin unidad.
   */
  describe('rama deducida por edad', () => {
    const patrolLeader = {
      _id: 'p10',
      name: 'Guia Patrulla',
      tipo: 'protagonista' as const,
      cargoSiscout: 'GUIA DE PATRULLA',
      age: 13,
    };

    it('rescata al protagonista cuyo cargo no es una rama', () => {
      const plan = planGroupSeed({
        groupId: 304,
        people: [chief, patrolLeader],
      });
      expect(plan.discarded).toEqual([]);
      expect(plan.units.find((u) => u.branch === 'tropa')?.members).toEqual([
        'p10',
      ]);
    });

    it('sirve también cuando no viene cargo alguno', () => {
      const plan = planGroupSeed({
        groupId: 304,
        people: [
          chief,
          { _id: 'p11', name: 'Sin Cargo', tipo: 'protagonista', age: 19 },
        ],
      });
      expect(plan.units.find((u) => u.branch === 'clan')?.members).toEqual([
        'p11',
      ]);
    });

    it('el cargo legible manda sobre la edad', () => {
      // Un repitente o un adelantado está en la rama que DECLARA su cargo, no
      // en la que le tocaría por años: una inferencia no pisa un dato afirmado.
      const plan = planGroupSeed({
        groupId: 304,
        people: [chief, { ...cub, age: 13 }],
      });
      expect(plan.units.map((u) => u.branch)).toEqual(['manada']);
      expect(plan.units[0].members).toEqual(['p1']);
    });

    it('agrupa en la misma unidad al que llega por cargo y al que llega por edad', () => {
      const plan = planGroupSeed({
        groupId: 304,
        people: [chief, scout, patrolLeader],
      });
      const troop = plan.units.find((u) => u.branch === 'tropa');
      expect(troop?.members.sort()).toEqual(['p10', 'p3']);
    });

    it('no rescata a quien queda fuera de la progresión', () => {
      const plan = planGroupSeed({
        groupId: 304,
        people: [
          chief,
          cub,
          { _id: 'p12', name: 'Fuera de Rango', tipo: 'protagonista', age: 30 },
        ],
      });
      expect(plan.discarded.map((p) => p._id)).toEqual(['p12']);
    });
  });
});
