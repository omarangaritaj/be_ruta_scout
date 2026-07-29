import {
  ACCESS_LEVELS,
  ACCESS_STATES,
  BRANCHES,
  BRANCH_AGE_RANGES,
  BRANCH_SISCOUT_ALIASES,
  D,
  branchFromAge,
  PERMISSION_KEYS,
  PERSON_TYPES,
  REQUEST_STATES,
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

  describe('branchFromAge', () => {
    it('resuelve la rama de cada tramo de la progresión', () => {
      expect(branchFromAge(3)).toBe('familia');
      expect(branchFromAge(8)).toBe('manada');
      expect(branchFromAge(12)).toBe('tropa');
      expect(branchFromAge(16)).toBe('comunidad');
      expect(branchFromAge(20)).toBe('clan');
    });

    it('incluye ambos extremos de cada tramo', () => {
      for (const { branch, min, max } of BRANCH_AGE_RANGES) {
        expect(branchFromAge(min)).toBe(branch);
        expect(branchFromAge(max)).toBe(branch);
      }
    });

    it('cubre sin huecos desde 0 hasta el tope de la progresión', () => {
      const tope = BRANCH_AGE_RANGES[BRANCH_AGE_RANGES.length - 1].max;
      for (let edad = 0; edad <= tope; edad += 1) {
        expect(branchFromAge(edad)).toBeDefined();
      }
    });

    it('no adivina fuera de la progresión ni sin dato', () => {
      const tope = BRANCH_AGE_RANGES[BRANCH_AGE_RANGES.length - 1].max;
      expect(branchFromAge(tope + 1)).toBeUndefined();
      expect(branchFromAge(-1)).toBeUndefined();
      expect(branchFromAge(null)).toBeUndefined();
      expect(branchFromAge(undefined)).toBeUndefined();
      // Una edad fraccionaria significa que el contrato cambió: mejor
      // reportarla como descartada que redondear a una rama vecina.
      expect(branchFromAge(9.5)).toBeUndefined();
      expect(branchFromAge(NaN)).toBeUndefined();
    });

    it('respeta el orden de la progresión en los tramos', () => {
      expect(BRANCH_AGE_RANGES.map((r) => r.branch)).toEqual([...BRANCHES]);
    });
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

  it('separa el estado de una solicitud del estado de acceso', () => {
    expect(REQUEST_STATES).toEqual([
      'pendiente',
      'en_revision',
      'aprobada',
      'rechazada',
      'cancelada',
    ]);
    expect(D.REQUEST_STATE.APPROVED).toBe('aprobada');
    expect(D.ACCESS_STATE.APPROVED).toBe('aprobado');
  });

  it('distingue niveles de acceso de niveles de cargo', () => {
    expect(ACCESS_LEVELS).toContain('super_admin');
    expect(ROLE_LEVELS).not.toContain('super_admin');
    expect(ROLE_LEVELS).toEqual(['rama', 'grupo', 'region', 'nacion']);
  });

  it('tiene los dos tipos de persona', () => {
    expect(PERSON_TYPES).toEqual(['adulto', 'protagonista']);
  });

  it('tiene los 29 permisos del catálogo', () => {
    expect(PERMISSION_KEYS).toHaveLength(29);
    expect(PERMISSION_KEYS).toContain('user:read');
  });

  it('expone el accesor tipado D', () => {
    expect(D.BRANCH.MANADA).toBe('manada');
    expect(D.ACCESS_STATE.APPROVED).toBe('aprobado');
    expect(D.ACCESS_LEVEL.SUPER_ADMIN).toBe('super_admin');
    expect(D.PERSON_TYPE.ADULT).toBe('adulto');
  });
});
