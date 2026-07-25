import { randomBytes } from 'node:crypto';
import { LEGACY_KID, isValidKeyring, parseKeyring } from './keyring';

const VARIABLE = 'SISCOUT_ENCRYPTION_KEY';

/** Clave válida de 32 bytes en base64. */
function base64Key(): string {
  return randomBytes(32).toString('base64');
}

/** La misma clave, en hex. */
function hexKey(): string {
  return randomBytes(32).toString('hex');
}

describe('parseKeyring', () => {
  it('acepta una clave desnuda y le asigna el identificador heredado', () => {
    const key = base64Key();

    const keyring = parseKeyring(key, VARIABLE);

    expect(keyring.activeKid).toBe(LEGACY_KID);
    expect(keyring.keys.size).toBe(1);
    expect(keyring.keys.get(LEGACY_KID)).toEqual(Buffer.from(key, 'base64'));
  });

  it('acepta la clave en hexadecimal', () => {
    const key = hexKey();

    const keyring = parseKeyring(key, VARIABLE);

    expect(keyring.keys.get(LEGACY_KID)).toEqual(Buffer.from(key, 'hex'));
  });

  it('toma la PRIMERA entrada como clave activa', () => {
    const nueva = base64Key();
    const vieja = base64Key();

    const keyring = parseKeyring(`v2:${nueva},v1:${vieja}`, VARIABLE);

    expect(keyring.activeKid).toBe('v2');
    expect(keyring.keys.size).toBe(2);
    expect(keyring.keys.get('v2')).toEqual(Buffer.from(nueva, 'base64'));
    expect(keyring.keys.get('v1')).toEqual(Buffer.from(vieja, 'base64'));
  });

  it('tolera espacios alrededor de las entradas', () => {
    const keyring = parseKeyring(
      ` v2 : ${base64Key()} ,  v1:${base64Key()} `,
      VARIABLE,
    );

    expect(keyring.activeKid).toBe('v2');
    expect(keyring.keys.size).toBe(2);
  });

  it('rechaza un valor vacío', () => {
    expect(() => parseKeyring('  ', VARIABLE)).toThrow(
      /no contiene ninguna clave/,
    );
  });

  it('rechaza identificadores de clave repetidos', () => {
    expect(() =>
      parseKeyring(`v1:${base64Key()},v1:${base64Key()}`, VARIABLE),
    ).toThrow(/'v1' está repetido/);
  });

  it('rechaza una clave que no decodifica a 32 bytes', () => {
    const corta = randomBytes(16).toString('base64');

    expect(() => parseKeyring(`v1:${corta}`, VARIABLE)).toThrow(
      /decodifica a 16 bytes/,
    );
  });

  it('rechaza un identificador de clave con caracteres inválidos', () => {
    expect(() => parseKeyring(`clave rara:${base64Key()}`, VARIABLE)).toThrow(
      /no es un identificador de clave válido/,
    );
  });

  it('nombra la variable de entorno en el mensaje de error', () => {
    expect(() => parseKeyring('', 'SISCOUT_CREDENTIALS_KEY')).toThrow(
      /SISCOUT_CREDENTIALS_KEY/,
    );
  });
});

describe('isValidKeyring', () => {
  it('acepta lo que parseKeyring acepta', () => {
    expect(isValidKeyring(base64Key())).toBe(true);
    expect(isValidKeyring(`v2:${base64Key()},v1:${base64Key()}`)).toBe(true);
  });

  it('rechaza lo que parseKeyring rechaza', () => {
    expect(isValidKeyring('')).toBe(false);
    expect(isValidKeyring('no-es-una-clave')).toBe(false);
    expect(isValidKeyring(randomBytes(16).toString('base64'))).toBe(false);
  });
});
