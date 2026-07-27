import {
  ACCESS_LEVELS,
  ACCESS_STATES,
  BRANCHES,
  BRANCH_SISCOUT_ALIASES,
  D,
  PERMISSION_KEYS,
  PERSON_TYPES,
  ROLE_LEVELS,
} from './index';

describe('diccionario de dominio', () => {
  it('tiene las cinco ramas en orden de progresión', () => {
    expect(BRANCHES).toEqual([
      'familia',
      'manada',
      'tropa',
      'comunidad',
      'clan',
    ]);
  });

  it('mapea los alias de SiScout a su rama', () => {
    expect(BRANCH_SISCOUT_ALIASES.LOBATOS).toBe('manada');
    expect(BRANCH_SISCOUT_ALIASES.MANADA).toBe('manada');
    expect(BRANCH_SISCOUT_ALIASES['NOMADAS SCOUT']).toBe('comunidad');
  });

  it('tiene los cinco estados de acceso', () => {
    expect(ACCESS_STATES).toEqual([
      'sin_solicitud',
      'pendiente',
      'aprobado',
      'rechazado',
      'suspendido',
    ]);
  });

  it('distingue niveles de acceso de niveles de cargo', () => {
    expect(ACCESS_LEVELS).toContain('super_admin');
    expect(ROLE_LEVELS).not.toContain('super_admin');
    expect(ROLE_LEVELS).toEqual(['rama', 'grupo', 'region', 'nacion']);
  });

  it('tiene los dos tipos de persona', () => {
    expect(PERSON_TYPES).toEqual(['adulto', 'protagonista']);
  });

  it('tiene los 21 permisos del catálogo', () => {
    expect(PERMISSION_KEYS).toHaveLength(21);
    expect(PERMISSION_KEYS).toContain('user:read');
  });

  it('expone el accesor tipado D', () => {
    expect(D.BRANCH.MANADA).toBe('manada');
    expect(D.ACCESS_STATE.APPROVED).toBe('aprobado');
    expect(D.ACCESS_LEVEL.SUPER_ADMIN).toBe('super_admin');
    expect(D.PERSON_TYPE.ADULT).toBe('adulto');
  });
});
