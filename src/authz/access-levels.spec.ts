import { ACCESS_LEVELS } from '../domain';
import { canGrantLevel, levelRank } from './access-levels';

describe('ACCESS_LEVELS', () => {
  /**
   * La jerarquía de privilegios ES el orden de este arreglo: no hay ningún campo
   * `order` en el manifiesto que la haga explícita. Este test la fija para que
   * reordenarlo salga en rojo en vez de cambiar en silencio quién concede qué.
   */
  it('va de menor a mayor privilegio', () => {
    expect([...ACCESS_LEVELS]).toEqual([
      'rama',
      'grupo',
      'region',
      'nacion',
      'super_admin',
    ]);
  });

  it('rama < grupo < region < nacion < super_admin', () => {
    expect(levelRank('rama')).toBeLessThan(levelRank('grupo'));
    expect(levelRank('grupo')).toBeLessThan(levelRank('region'));
    expect(levelRank('region')).toBeLessThan(levelRank('nacion'));
    expect(levelRank('nacion')).toBeLessThan(levelRank('super_admin'));
  });

  it('quien no tiene nivel queda por debajo de todos', () => {
    for (const level of ACCESS_LEVELS) {
      expect(levelRank(undefined)).toBeLessThan(levelRank(level));
    }
  });
});

describe('canGrantLevel', () => {
  it('un actor de nivel grupo NO concede region ni nacion', () => {
    expect(canGrantLevel('grupo', 'region')).toBe(false);
    expect(canGrantLevel('grupo', 'nacion')).toBe(false);
    expect(canGrantLevel('grupo', 'super_admin')).toBe(false);
  });

  it('un actor de nivel grupo concede grupo y lo que está por debajo', () => {
    expect(canGrantLevel('grupo', 'grupo')).toBe(true);
    expect(canGrantLevel('grupo', 'rama')).toBe(true);
  });

  it('un actor de nivel nacion concede grupo, region y nacion', () => {
    expect(canGrantLevel('nacion', 'grupo')).toBe(true);
    expect(canGrantLevel('nacion', 'region')).toBe(true);
    expect(canGrantLevel('nacion', 'nacion')).toBe(true);
  });

  it('un actor de nivel nacion NO concede super_admin', () => {
    expect(canGrantLevel('nacion', 'super_admin')).toBe(false);
  });

  it('un super_admin concede cualquier nivel, incluido el suyo', () => {
    for (const level of ACCESS_LEVELS) {
      expect(canGrantLevel('super_admin', level)).toBe(true);
    }
  });

  it('un actor SIN nivel no concede ninguno: falla cerrado', () => {
    for (const level of ACCESS_LEVELS) {
      expect(canGrantLevel(undefined, level)).toBe(false);
    }
  });

  it('un actor de nivel rama solo concede rama', () => {
    expect(canGrantLevel('rama', 'rama')).toBe(true);
    expect(canGrantLevel('rama', 'grupo')).toBe(false);
  });
});
