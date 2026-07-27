import { resolverAlcance } from './alcance-unidades';

describe('alcance de unidades', () => {
  it('el super admin y la nación no filtran', () => {
    expect(resolverAlcance({ nivelAcceso: 'super_admin' })).toEqual({
      tipo: 'todas',
    });
    expect(resolverAlcance({ nivelAcceso: 'nacion', groupId: 7 })).toEqual({
      tipo: 'todas',
    });
  });

  it('sin grupo no hay unidades que mostrar', () => {
    expect(resolverAlcance({ cargoSiscout: 'JEFE DE MANADA' })).toEqual({
      tipo: 'sin-grupo',
    });
  });

  it('deriva la rama del cargo de SiScout', () => {
    expect(
      resolverAlcance({ groupId: 304, cargoSiscout: 'JEFE DE TROPA' }),
    ).toEqual({ tipo: 'rama', rama: 'tropa', groupId: 304 });
  });

  it('deriva la rama de un protagonista, que trae la rama y no un cargo', () => {
    expect(resolverAlcance({ groupId: 304, cargoSiscout: 'LOBATO' })).toEqual({
      tipo: 'rama',
      rama: 'manada',
      groupId: 304,
    });
  });

  it('el cargo asignado por la plataforma gana al de SiScout', () => {
    expect(
      resolverAlcance({
        groupId: 304,
        cargoSiscout: 'JEFE DE TROPA',
        cargos: [{ nombreCargo: 'JEFE DE CLAN', nivel: 'rama' }],
      }),
    ).toEqual({ tipo: 'rama', rama: 'clan', groupId: 304 });
  });

  it('el jefe de grupo ve todas las unidades de su grupo', () => {
    expect(
      resolverAlcance({ groupId: 304, cargoSiscout: 'JEFE DE GRUPO' }),
    ).toEqual({ tipo: 'grupo', groupId: 304 });
  });

  it('un cargo que no determina rama exige preguntar la jefatura', () => {
    expect(
      resolverAlcance({ groupId: 304, cargoSiscout: 'COLABORADOR DE GRUPO' }),
    ).toEqual({ tipo: 'jefatura-requerida', groupId: 304 });
  });

  it('sin cargo alguno también hay que preguntar', () => {
    expect(resolverAlcance({ groupId: 304 })).toEqual({
      tipo: 'jefatura-requerida',
      groupId: 304,
    });
  });

  it('un cargo de otro nivel no se confunde con una jefatura de rama', () => {
    expect(
      resolverAlcance({
        groupId: 304,
        cargoSiscout: 'COMISIONADO(A) NACIONAL PARA LOBATOS',
      }),
    ).toEqual({ tipo: 'jefatura-requerida', groupId: 304 });
  });
});
