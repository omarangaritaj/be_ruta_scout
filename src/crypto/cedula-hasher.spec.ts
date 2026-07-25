import { CedulaHasher } from './cedula-hasher';
import { parseKeyring } from './keyring';

const keyring = parseKeyring(Buffer.alloc(32, 1).toString('base64'), 'TEST');

describe('CedulaHasher', () => {
  const hasher = new CedulaHasher(keyring);

  it('es determinista: misma cédula → mismo hash', () => {
    expect(hasher.hash('1234567890')).toBe(hasher.hash('1234567890'));
  });

  it('normaliza los espacios alrededor', () => {
    expect(hasher.hash('  1234567890 ')).toBe(hasher.hash('1234567890'));
  });

  it('cédulas distintas → hashes distintos', () => {
    expect(hasher.hash('111')).not.toBe(hasher.hash('222'));
  });

  it('clave distinta → hash distinto', () => {
    const otra = new CedulaHasher(
      parseKeyring(Buffer.alloc(32, 2).toString('base64'), 'TEST'),
    );
    expect(otra.hash('111')).not.toBe(hasher.hash('111'));
  });

  it('sin keyring, isReady() es false y hash() lanza', () => {
    const vacio = new CedulaHasher(null);
    expect(vacio.isReady()).toBe(false);
    expect(() => vacio.hash('111')).toThrow();
  });
});
