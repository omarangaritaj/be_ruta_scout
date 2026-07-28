import { addedValues, ungrantable } from './escalation';

function owned(...values: string[]): ReadonlySet<string> {
  return new Set(values);
}

describe('ungrantable', () => {
  it('el comodín total concede cualquier cosa, incluido el propio comodín', () => {
    expect(ungrantable(owned('*'), ['unit:read', 'role:delete', '*'])).toEqual(
      [],
    );
  });

  it('un comodín de recurso concede las acciones de ese recurso', () => {
    expect(ungrantable(owned('unit:*'), ['unit:read', 'unit:delete'])).toEqual(
      [],
    );
  });

  it('un comodín de recurso NO concede otro recurso', () => {
    expect(ungrantable(owned('unit:*'), ['role:read'])).toEqual(['role:read']);
  });

  it('un permiso concreto NO concede el comodín de su recurso', () => {
    expect(ungrantable(owned('unit:read'), ['unit:*'])).toEqual(['unit:*']);
  });

  it('un permiso concreto NO concede el comodín total', () => {
    expect(ungrantable(owned('unit:read'), ['*'])).toEqual(['*']);
  });

  it('un permiso concreto se concede a sí mismo', () => {
    expect(ungrantable(owned('unit:read'), ['unit:read'])).toEqual([]);
  });

  it('sin nada propio no se concede nada', () => {
    expect(ungrantable(owned(), ['unit:read'])).toEqual(['unit:read']);
  });

  it('devuelve todo lo que falta, no solo lo primero', () => {
    expect(
      ungrantable(owned('unit:read'), ['role:read', 'unit:delete']),
    ).toEqual(['role:read', 'unit:delete']);
  });

  it('no repite el mismo faltante dos veces', () => {
    expect(ungrantable(owned(), ['*', '*'])).toEqual(['*']);
  });

  it('con rutas, el comodín total concede cualquier página', () => {
    expect(ungrantable(owned('*'), ['/units', '/admin/roles'])).toEqual([]);
  });

  it('con rutas, una página concreta NO concede el comodín total', () => {
    expect(ungrantable(owned('/units'), ['*'])).toEqual(['*']);
  });

  it('con rutas, una página no concede otra', () => {
    expect(ungrantable(owned('/units'), ['/admin/roles'])).toEqual([
      '/admin/roles',
    ]);
  });
});

describe('addedValues', () => {
  it('solo devuelve lo que se añade', () => {
    expect(addedValues(['unit:read'], ['unit:read', 'unit:create'])).toEqual([
      'unit:create',
    ]);
  });

  it('quitar no añade nada', () => {
    expect(addedValues(['unit:read', 'unit:create'], ['unit:read'])).toEqual(
      [],
    );
  });

  it('reemplazar por completo cuenta como añadir lo nuevo', () => {
    expect(addedValues(['unit:read'], ['role:read'])).toEqual(['role:read']);
  });

  it('sin estado previo, todo es añadido', () => {
    expect(addedValues(undefined, ['*'])).toEqual(['*']);
  });

  it('deduplica lo añadido', () => {
    expect(addedValues([], ['*', '*'])).toEqual(['*']);
  });
});
