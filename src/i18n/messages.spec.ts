import { CATALOG } from './catalog';
import { K, capitalize, t, type MessageKey } from './messages';

describe('t', () => {
  it('devuelve el mensaje tal cual cuando no lleva placeholders', () => {
    expect(t(K.AUTH.INVALID_CREDENTIALS)).toBe('Credenciales inválidas');
  });

  it('interpola parámetros simples', () => {
    expect(t(K.USERS.NOT_FOUND, { id: 'abc' })).toBe(
      'No existe un usuario con id "abc"',
    );
  });

  it('deja vacío el parámetro que no se pasa', () => {
    expect(t(K.GROUPS.NOT_FOUND)).toBe('No existe un grupo con id ""');
  });

  it('interpola el mismo parámetro las veces que aparezca', () => {
    expect(t(K.SISCOUT.CREDENTIAL_NOT_FOUND, { nombre: 'nacional' })).toBe(
      "No existe la credencial 'nacional'",
    );
  });
});

describe('K', () => {
  it('expone cada clave del catálogo como "DOMINIO.CLAVE"', () => {
    expect(K.AUTH.ACCOUNT_GONE).toBe('AUTH.ACCOUNT_GONE');
    expect(K.VALIDATION.INVALID_INPUT).toBe('VALIDATION.INVALID_INPUT');
  });

  it('cubre todos los dominios del catálogo', () => {
    expect(Object.keys(K).sort()).toEqual(Object.keys(CATALOG).sort());
  });
});

describe('capitalize', () => {
  it('capitaliza la primera letra y no toca el resto', () => {
    expect(capitalize('hola SiScout')).toBe('Hola SiScout');
  });

  it('tolera vacío y nulo', () => {
    expect(capitalize('')).toBe('');
    expect(capitalize(null)).toBe('');
    expect(capitalize(undefined)).toBe('');
  });
});

describe('catálogo', () => {
  it('renderiza todas sus entradas sin dejar placeholders sin resolver', () => {
    const pendientes: string[] = [];

    for (const [domain, group] of Object.entries(CATALOG)) {
      for (const [key, template] of Object.entries(
        group as Record<string, string>,
      )) {
        const messageKey = `${domain}.${key}` as MessageKey;
        const params: Record<string, string | number> = {};
        const re = /\{\s*(\w+)\s*(?:,\s*(number|plural)\b)?/g;
        let match = re.exec(template);
        while (match) {
          const [, name, type] = match;
          params[name] = type === 'number' ? 1234 : 'X';
          match = re.exec(template);
        }
        if (/[{}]/.test(t(messageKey, params))) pendientes.push(messageKey);
      }
    }

    expect(pendientes).toEqual([]);
  });
});
