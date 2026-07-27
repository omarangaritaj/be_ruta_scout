import { cargoEsValido, cargosPorNivel, ramaDeCargo } from './catalogo-cargos';

describe('catálogo de cargos', () => {
  it('acepta un cargo del nivel correcto', () => {
    expect(cargoEsValido('JEFE DE GRUPO', 'grupo')).toBe(true);
  });

  it('rechaza un cargo de otro nivel', () => {
    expect(cargoEsValido('JEFE DE GRUPO', 'region')).toBe(false);
  });

  it('cargosPorNivel(region) no está vacío', () => {
    expect(cargosPorNivel('region').length).toBeGreaterThan(0);
  });

  it('las jefaturas de rama viven en el nivel rama', () => {
    expect(cargoEsValido('JEFE DE MANADA', 'rama')).toBe(true);
    expect(cargoEsValido('JEFE DE MANADA', 'grupo')).toBe(false);
  });

  it('cada cargo de nivel rama declara su rama', () => {
    for (const cargo of cargosPorNivel('rama')) {
      expect(cargo.rama).toBeDefined();
    }
  });

  it('ramaDeCargo resuelve la jefatura de rama', () => {
    expect(ramaDeCargo('JEFE DE MANADA')).toBe('manada');
    expect(ramaDeCargo('SUB-JEFE DE CLAN')).toBe('clan');
    expect(ramaDeCargo('JEFE DE FAMILIA')).toBe('familia');
  });

  it('un cargo que no manda sobre una rama concreta no la determina', () => {
    expect(ramaDeCargo('JEFE DE GRUPO')).toBeUndefined();
    expect(ramaDeCargo('COMISIONADO(A) NACIONAL PARA LOBATOS')).toBeUndefined();
    expect(ramaDeCargo('COLABORADOR DE GRUPO')).toBeUndefined();
    expect(ramaDeCargo(undefined)).toBeUndefined();
  });
});
