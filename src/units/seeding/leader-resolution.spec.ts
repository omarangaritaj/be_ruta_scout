import { resolveUnitLeader } from './leader-resolution';

const branchChief = {
  _id: 'a1',
  name: 'Zulema Ruiz',
  cargoSiscout: 'JEFE DE MANADA',
};
const groupChief = { _id: 'a2', name: 'Bruno Diaz', cargoSiscout: 'JEFE DE GRUPO' };
const collaborator = {
  _id: 'a3',
  name: 'Carla Pena',
  cargoSiscout: 'COLABORADOR DE GRUPO',
};
const anyAdult = { _id: 'a4', name: 'Alba Soto', cargoSiscout: 'ACOMPANANTE' };

describe('resolveUnitLeader', () => {
  it('el jefe de rama gana a todos', () => {
    const all = [anyAdult, collaborator, groupChief, branchChief];
    expect(resolveUnitLeader('manada', all)?._id).toBe('a1');
  });

  it('sin jefe de rama pasa al jefe de grupo', () => {
    expect(
      resolveUnitLeader('manada', [anyAdult, collaborator, groupChief])?._id,
    ).toBe('a2');
  });

  it('sin jefe de grupo pasa al colaborador', () => {
    expect(resolveUnitLeader('manada', [anyAdult, collaborator])?._id).toBe('a3');
  });

  it('en ultimo lugar cualquier adulto', () => {
    expect(resolveUnitLeader('manada', [anyAdult])?._id).toBe('a4');
  });

  it('el jefe de otra rama no sirve para esta', () => {
    const otherBranch = {
      _id: 'a5',
      name: 'Elsa Mora',
      cargoSiscout: 'JEFE DE TROPA',
    };
    expect(resolveUnitLeader('manada', [otherBranch, groupChief])?._id).toBe('a2');
  });

  it('el cargo asignado por la plataforma gana al de SiScout', () => {
    const assigned = {
      _id: 'a6',
      name: 'Nora Gil',
      cargoSiscout: 'ACOMPANANTE',
      cargos: [{ nombreCargo: 'JEFE DE MANADA', nivel: 'rama' }],
    };
    expect(resolveUnitLeader('manada', [groupChief, assigned])?._id).toBe('a6');
  });

  it('el titular gana al subjefe dentro de la misma rama', () => {
    const deputy = {
      _id: 'a7',
      name: 'Aaron Paz',
      cargoSiscout: 'SUB-JEFE DE MANADA',
    };
    expect(resolveUnitLeader('manada', [deputy, branchChief])?._id).toBe('a1');
  });

  it('desempata alfabeticamente para ser determinista', () => {
    const first = { _id: 'a8', name: 'Ana Lopez', cargoSiscout: 'ACOMPANANTE' };
    const second = { _id: 'a9', name: 'Zoe Marin', cargoSiscout: 'ACOMPANANTE' };
    expect(resolveUnitLeader('manada', [second, first])?._id).toBe('a8');
  });

  it('sin adultos no hay jefe', () => {
    expect(resolveUnitLeader('manada', [])).toBeUndefined();
  });
});
