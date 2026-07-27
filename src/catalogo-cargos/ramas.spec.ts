import { esRama, ramaDeEtiquetaSiscout } from './ramas';

describe('ramas', () => {
  it('mapea el nombre de la unidad que trae el adulto', () => {
    expect(ramaDeEtiquetaSiscout('MANADA')).toBe('manada');
    expect(ramaDeEtiquetaSiscout('CLAN')).toBe('clan');
  });

  it('mapea el nombre de la rama que trae el protagonista', () => {
    expect(ramaDeEtiquetaSiscout('LOBATO')).toBe('manada');
    expect(ramaDeEtiquetaSiscout('SCOUT')).toBe('tropa');
    expect(ramaDeEtiquetaSiscout('ROVER')).toBe('clan');
  });

  it('normaliza mayúsculas, tildes y espacios de más', () => {
    expect(ramaDeEtiquetaSiscout('  nómadas   scout ')).toBe('comunidad');
  });

  it('no mapea por subcadena: un comisionado no dirige una manada', () => {
    expect(
      ramaDeEtiquetaSiscout('COMISIONADO(A) NACIONAL PARA LOBATOS'),
    ).toBeUndefined();
  });

  it('tolera la ausencia de etiqueta', () => {
    expect(ramaDeEtiquetaSiscout(null)).toBeUndefined();
    expect(ramaDeEtiquetaSiscout('')).toBeUndefined();
  });

  it('esRama distingue una rama de cualquier otro texto', () => {
    expect(esRama('manada')).toBe(true);
    expect(esRama('MANADA')).toBe(false);
    expect(esRama('lobato')).toBe(false);
  });
});
