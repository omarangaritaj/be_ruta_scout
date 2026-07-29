import { BRANCHES, growthAreasOf, type Branch } from '../../domain';
import catalog from './growth-items.json';

describe('catálogo semilla de dimensiones', () => {
  it('trae los 93 items del marco educativo', () => {
    expect(catalog).toHaveLength(93);
  });

  it('cubre las cinco ramas', () => {
    const ramas = new Set(catalog.map((item) => item.branch));

    expect([...ramas].sort()).toEqual([...BRANCHES].sort());
  });

  it('usa solo áreas que la rama admite', () => {
    for (const item of catalog) {
      expect(growthAreasOf(item.branch as Branch)).toContain(item.growthArea);
    }
  });

  it('numera el orden desde 1 y sin huecos dentro de cada rama y área', () => {
    const grupos = new Map<string, number[]>();
    for (const item of catalog) {
      const clave = `${item.branch}/${item.growthArea}`;
      grupos.set(clave, [...(grupos.get(clave) ?? []), item.order]);
    }

    for (const [clave, ordenes] of grupos) {
      const esperado = ordenes.map((_, index) => index + 1);
      expect([...ordenes].sort((a, b) => a - b)).toEqual(esperado);
      expect(clave).toBeTruthy();
    }
  });

  it('no trae textos vacíos', () => {
    for (const item of catalog) {
      expect(item.text.trim().length).toBeGreaterThan(0);
    }
  });
});
