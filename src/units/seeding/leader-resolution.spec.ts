import { leadersOfBranch, resolveUnitLeader } from './leader-resolution';

const branchChief = {
  id: 'a1',
  name: 'Zulema Ruiz',
  cargoSiscout: 'JEFE DE MANADA',
};
const groupChief = {
  id: 'a2',
  name: 'Bruno Diaz',
  cargoSiscout: 'JEFE DE GRUPO',
};
const collaborator = {
  id: 'a3',
  name: 'Carla Pena',
  cargoSiscout: 'COLABORADOR DE GRUPO',
};
const anyAdult = { id: 'a4', name: 'Alba Soto', cargoSiscout: 'ACOMPANANTE' };

describe('resolveUnitLeader', () => {
  it('el jefe de rama gana a todos', () => {
    const all = [anyAdult, collaborator, groupChief, branchChief];
    expect(resolveUnitLeader('manada', all)?.id).toBe('a1');
  });

  it('sin jefe de rama pasa al jefe de grupo', () => {
    expect(
      resolveUnitLeader('manada', [anyAdult, collaborator, groupChief])?.id,
    ).toBe('a2');
  });

  it('sin jefe de grupo pasa al colaborador', () => {
    expect(resolveUnitLeader('manada', [anyAdult, collaborator])?.id).toBe(
      'a3',
    );
  });

  it('en ultimo lugar cualquier adulto', () => {
    expect(resolveUnitLeader('manada', [anyAdult])?.id).toBe('a4');
  });

  it('el jefe de otra rama no sirve para esta', () => {
    const otherBranch = {
      id: 'a5',
      name: 'Elsa Mora',
      cargoSiscout: 'JEFE DE TROPA',
    };
    expect(resolveUnitLeader('manada', [otherBranch, groupChief])?.id).toBe(
      'a2',
    );
  });

  it('el cargo asignado por la plataforma gana al de SiScout', () => {
    const assigned = {
      id: 'a6',
      name: 'Nora Gil',
      cargoSiscout: 'ACOMPANANTE',
      cargos: [{ nombreCargo: 'JEFE DE MANADA', nivel: 'rama' }],
    };
    expect(resolveUnitLeader('manada', [groupChief, assigned])?.id).toBe('a6');
  });

  it('el titular gana al subjefe dentro de la misma rama', () => {
    const deputy = {
      id: 'a7',
      name: 'Aaron Paz',
      cargoSiscout: 'SUB-JEFE DE MANADA',
    };
    expect(resolveUnitLeader('manada', [deputy, branchChief])?.id).toBe('a1');
  });

  it('desempata alfabeticamente para ser determinista', () => {
    const first = { id: 'a8', name: 'Ana Lopez', cargoSiscout: 'ACOMPANANTE' };
    const second = {
      id: 'a9',
      name: 'Zoe Marin',
      cargoSiscout: 'ACOMPANANTE',
    };
    expect(resolveUnitLeader('manada', [second, first])?.id).toBe('a8');
  });

  it('sin adultos no hay jefe', () => {
    expect(resolveUnitLeader('manada', [])).toBeUndefined();
  });
});

describe('leadersOfBranch', () => {
  const deputy = {
    id: 'a7',
    name: 'Aaron Paz',
    cargoSiscout: 'SUB-JEFE DE MANADA',
  };

  it('reune al titular y a los subjefes de esa rama', () => {
    expect(
      leadersOfBranch('manada', [branchChief, deputy, groupChief]).map(
        (a) => a.id,
      ),
    ).toEqual(['a7', 'a1']);
  });

  it('deja fuera a quien no tiene jefatura de la rama', () => {
    expect(
      leadersOfBranch('manada', [groupChief, collaborator, anyAdult]),
    ).toEqual([]);
  });

  it('no arrastra la jefatura de otra rama', () => {
    const otherBranch = {
      id: 'a5',
      name: 'Elsa Mora',
      cargoSiscout: 'JEFE DE TROPA',
    };
    expect(
      leadersOfBranch('manada', [otherBranch, branchChief]).map((a) => a.id),
    ).toEqual(['a1']);
  });

  it('cuenta el cargo asignado por la plataforma, no solo el de SiScout', () => {
    const assigned = {
      id: 'a6',
      name: 'Nora Gil',
      cargoSiscout: 'ACOMPANANTE',
      cargos: [{ nombreCargo: 'SUB-JEFE DE MANADA', nivel: 'rama' }],
    };
    expect(
      leadersOfBranch('manada', [assigned, branchChief]).map((a) => a.id),
    ).toEqual(['a6', 'a1']);
  });

  it('sin adultos no hay jefatura alguna', () => {
    expect(leadersOfBranch('manada', [])).toEqual([]);
  });
});
