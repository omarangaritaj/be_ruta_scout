import { resolverTerritorio } from './territorio';

describe('resolverTerritorio', () => {
  it('nación no lleva territorio', () => {
    expect(resolverTerritorio('nacion', null, {})).toEqual({});
  });

  it('grupo: usa el group_id del snapshot', () => {
    const r = resolverTerritorio(
      'grupo',
      { group_id: 304, district_id: 2 },
      {},
    );
    expect(r).toEqual({ groupId: 304, districtId: 2 });
  });

  it('grupo: si el snapshot no lo tiene, confía en el cliente', () => {
    const r = resolverTerritorio('grupo', null, { groupId: 99 });
    expect(r).toEqual({ groupId: 99, districtId: undefined });
  });

  it('grupo: sin group_id en ningún lado → error', () => {
    expect(resolverTerritorio('grupo', null, {})).toEqual({
      error: 'Falta el grupo',
    });
  });

  it('rama: deriva la rama del campo unidad del snapshot', () => {
    const r = resolverTerritorio(
      'rama',
      { unidad: 'MANADA', group_id: 304 },
      {},
    );
    expect(r).toEqual({ rama: 'manada', groupId: 304, districtId: undefined });
  });

  it('region: usa el district_id del cliente si el snapshot no lo trae', () => {
    expect(resolverTerritorio('region', null, { districtId: 5 })).toEqual({
      districtId: 5,
    });
  });
});
