import { isValidRouteResource } from './route-resources.catalog';

describe('isValidRouteResource', () => {
  it('acepta una ruta del catalogo', () => {
    expect(isValidRouteResource('/units')).toBe(true);
  });

  it('acepta el comodin total', () => {
    expect(isValidRouteResource('*')).toBe(true);
  });

  it('rechaza una ruta que no existe', () => {
    expect(isValidRouteResource('/inventada')).toBe(false);
  });

  it('rechaza una ruta con barra final que no esta en el catalogo', () => {
    expect(isValidRouteResource('/units/')).toBe(false);
  });

  it('rechaza una ruta con mayusculas aunque el path base exista', () => {
    expect(isValidRouteResource('/Units')).toBe(false);
  });

  it('rechaza la cadena vacia', () => {
    expect(isValidRouteResource('')).toBe(false);
  });

  it('rechaza el comodin por recurso, a diferencia de los permisos', () => {
    expect(isValidRouteResource('units:*')).toBe(false);
  });
});
