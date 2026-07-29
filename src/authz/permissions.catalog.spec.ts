import { PERMISSION_KEYS as DOMAIN_KEYS } from '../domain';
import {
  PERMISSIONS,
  granting,
  isValidPermission,
} from './permissions.catalog';

describe('catálogo de permisos', () => {
  it('describe exactamente los permisos del dominio', () => {
    expect(PERMISSIONS.map((p) => p.key).sort()).toEqual(
      [...DOMAIN_KEYS].sort(),
    );
  });

  it('da una descripción no vacía a cada permiso', () => {
    for (const permiso of PERMISSIONS) {
      expect(permiso.descripcion.length).toBeGreaterThan(0);
    }
  });

  it('acepta el comodín de recurso', () => {
    expect(isValidPermission('user:*')).toBe(true);
    expect(isValidPermission('inventado:*')).toBe(false);
    expect(isValidPermission('growth-item:*')).toBe(true);
    expect(isValidPermission('growth-item:read')).toBe(true);
  });

  it('concede por comodín total y por recurso', () => {
    expect(granting(new Set(['*']), 'user:read')).toBe(true);
    expect(granting(new Set(['user:*']), 'user:read')).toBe(true);
    expect(granting(new Set(['role:read']), 'user:read')).toBe(false);
  });
});
