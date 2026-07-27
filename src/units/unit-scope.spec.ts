import { resolveUnitScope, scopeReaches } from './unit-scope';

describe('alcance de unidades', () => {
  it('el super admin y la nación no filtran', () => {
    expect(resolveUnitScope({ nivelAcceso: 'super_admin' })).toEqual({
      type: 'all',
    });
    expect(resolveUnitScope({ nivelAcceso: 'nacion', groupId: 7 })).toEqual({
      type: 'all',
    });
  });

  it('sin grupo no hay unidades que mostrar', () => {
    expect(resolveUnitScope({ cargoSiscout: 'JEFE DE MANADA' })).toEqual({
      type: 'no-group',
    });
  });

  it('deriva la rama del cargo de SiScout', () => {
    expect(
      resolveUnitScope({ groupId: 304, cargoSiscout: 'JEFE DE TROPA' }),
    ).toEqual({ type: 'branch', branch: 'tropa', groupId: 304 });
  });

  it('deriva la rama de un protagonista, que trae la rama y no un cargo', () => {
    expect(resolveUnitScope({ groupId: 304, cargoSiscout: 'LOBATO' })).toEqual({
      type: 'branch',
      branch: 'manada',
      groupId: 304,
    });
  });

  it('el cargo asignado por la plataforma gana al de SiScout', () => {
    expect(
      resolveUnitScope({
        groupId: 304,
        cargoSiscout: 'JEFE DE TROPA',
        cargos: [{ nombreCargo: 'JEFE DE CLAN', nivel: 'rama' }],
      }),
    ).toEqual({ type: 'branch', branch: 'clan', groupId: 304 });
  });

  it('el jefe de grupo ve todas las unidades de su grupo', () => {
    expect(
      resolveUnitScope({ groupId: 304, cargoSiscout: 'JEFE DE GRUPO' }),
    ).toEqual({ type: 'group', groupId: 304 });
  });

  it('un cargo que no determina rama exige preguntar la jefatura', () => {
    expect(
      resolveUnitScope({ groupId: 304, cargoSiscout: 'COLABORADOR DE GRUPO' }),
    ).toEqual({ type: 'leadership-required', groupId: 304 });
  });

  it('sin cargo alguno también hay que preguntar', () => {
    expect(resolveUnitScope({ groupId: 304 })).toEqual({
      type: 'leadership-required',
      groupId: 304,
    });
  });

  it('un cargo de otro nivel no se confunde con una jefatura de rama', () => {
    expect(
      resolveUnitScope({
        groupId: 304,
        cargoSiscout: 'COMISIONADO(A) NACIONAL PARA LOBATOS',
      }),
    ).toEqual({ type: 'leadership-required', groupId: 304 });
  });
});

describe('scopeReaches', () => {
  const pack = { groupId: 304, branch: 'manada' as const };
  const troop = { groupId: 304, branch: 'tropa' as const };
  const foreign = { groupId: 999, branch: 'manada' as const };

  it('el alcance total llega a cualquier unidad', () => {
    expect(scopeReaches({ type: 'all' }, foreign)).toBe(true);
  });

  it('el alcance de grupo llega a cualquier rama de su grupo', () => {
    const scope = { type: 'group', groupId: 304 } as const;
    expect(scopeReaches(scope, pack)).toBe(true);
    expect(scopeReaches(scope, troop)).toBe(true);
  });

  it('el alcance de grupo no llega a otro grupo', () => {
    expect(scopeReaches({ type: 'group', groupId: 304 }, foreign)).toBe(false);
  });

  it('el alcance de rama exige grupo Y rama', () => {
    const scope = { type: 'branch', branch: 'manada', groupId: 304 } as const;
    expect(scopeReaches(scope, pack)).toBe(true);
    expect(scopeReaches(scope, troop)).toBe(false);
    expect(scopeReaches(scope, foreign)).toBe(false);
  });

  it('quien todavía debe declarar jefatura no alcanza ninguna unidad', () => {
    expect(
      scopeReaches({ type: 'leadership-required', groupId: 304 }, pack),
    ).toBe(false);
  });

  it('sin grupo no se alcanza nada', () => {
    expect(scopeReaches({ type: 'no-group' }, pack)).toBe(false);
  });
});
