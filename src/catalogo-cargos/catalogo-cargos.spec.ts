import { cargoEsValido, cargosPorNivel } from './catalogo-cargos';

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

  it('rama todavía no tiene cargos', () => {
    expect(cargosPorNivel('rama')).toEqual([]);
  });
});
