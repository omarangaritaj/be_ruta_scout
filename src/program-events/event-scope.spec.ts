import { canUseScope, isScopeCoherent } from './event-scope';

describe('isScopeCoherent', () => {
  it('exige alcance de rama para una reunión', () => {
    expect(isScopeCoherent('reunion', 'rama')).toBe(true);
    expect(isScopeCoherent('reunion', 'grupo')).toBe(false);
    expect(isScopeCoherent('reunion', 'nacion')).toBe(false);
  });

  it('admite cualquier alcance para una actividad', () => {
    expect(isScopeCoherent('actividad', 'rama')).toBe(true);
    expect(isScopeCoherent('actividad', 'grupo')).toBe(true);
    expect(isScopeCoherent('actividad', 'nacion')).toBe(true);
  });
});

describe('canUseScope', () => {
  it('deja usar el alcance propio', () => {
    expect(canUseScope('grupo', 'grupo')).toBe(true);
  });

  it('deja usar un alcance por debajo del propio', () => {
    expect(canUseScope('region', 'grupo')).toBe(true);
    expect(canUseScope('nacion', 'rama')).toBe(true);
  });

  it('impide usar un alcance por encima del propio', () => {
    expect(canUseScope('rama', 'grupo')).toBe(false);
    expect(canUseScope('grupo', 'region')).toBe(false);
  });

  it('impide cualquier alcance a quien no tiene nivel', () => {
    expect(canUseScope(undefined, 'rama')).toBe(false);
  });

  it('deja a super_admin usar cualquier alcance', () => {
    expect(canUseScope('super_admin', 'nacion')).toBe(true);
  });
});
