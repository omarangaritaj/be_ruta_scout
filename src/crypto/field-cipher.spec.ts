import { randomBytes } from 'node:crypto';
import { FieldCipher, isEncrypted } from './field-cipher';
import { parseKeyring } from './keyring';

const VARIABLE = 'SISCOUT_ENCRYPTION_KEY';

function key(): string {
  return randomBytes(32).toString('base64');
}

function cipherCon(raw: string): FieldCipher {
  return new FieldCipher(parseKeyring(raw, VARIABLE), VARIABLE);
}

describe('FieldCipher', () => {
  it('descifra lo que cifra', () => {
    const cipher = cipherCon(key());

    const cifrado = cipher.encrypt('1013599123');

    expect(cipher.decrypt(cifrado)).toBe('1013599123');
  });

  it('produce un cifrado distinto para el mismo texto', () => {
    const cipher = cipherCon(key());

    const primero = cipher.encrypt('mismo texto');
    const segundo = cipher.encrypt('mismo texto');

    // IV aleatorio por operación: de ahí que el hash de un documento deba
    // calcularse sobre el texto plano y nunca sobre el cifrado.
    expect(primero.data).not.toBe(segundo.data);
    expect(cipher.decrypt(segundo)).toBe('mismo texto');
  });

  it('sella cada valor con el identificador de la clave activa', () => {
    const cipher = cipherCon(`v2:${key()},v1:${key()}`);

    expect(cipher.encrypt('dato').kid).toBe('v2');
  });

  it('preserva los caracteres no ASCII', () => {
    const cipher = cipherCon(key());

    const texto = 'Nariño — Andrés Muñoz ñ á é í ó ú';

    expect(cipher.decrypt(cipher.encrypt(texto))).toBe(texto);
  });

  describe('rotación de clave', () => {
    it('sigue leyendo lo cifrado con la clave anterior', () => {
      const vieja = key();
      const nueva = key();

      const antes = cipherCon(vieja);
      const guardado = antes.encrypt('3001234567');

      // Se rota: la nueva pasa al frente y la anterior se conserva.
      const despues = cipherCon(`v2:${nueva},v1:${vieja}`);

      expect(despues.decrypt(guardado)).toBe('3001234567');
      expect(despues.encrypt('otro').kid).toBe('v2');
    });

    it('lee los documentos antiguos que no declaran clave', () => {
      const vieja = key();

      const antes = cipherCon(vieja);
      const guardado = antes.encrypt('correo@ejemplo.org');
      // Documento escrito antes de que el sobre llevara `kid`.
      delete guardado.kid;

      const despues = cipherCon(`v2:${key()},v1:${vieja}`);

      expect(despues.decrypt(guardado)).toBe('correo@ejemplo.org');
    });

    it('explica qué clave falta cuando ya no está configurada', () => {
      const guardado = cipherCon(`v9:${key()}`).encrypt('dato');

      const otro = cipherCon(`v2:${key()}`);

      expect(() => otro.decrypt(guardado)).toThrow(/no incluye la clave 'v9'/);
    });
  });

  describe('detección de manipulación', () => {
    it('rechaza un dato alterado en reposo', () => {
      const cipher = cipherCon(key());
      const cifrado = cipher.encrypt('1013599123');

      const alterado = { ...cifrado, data: randomBytes(8).toString('base64') };

      expect(() => cipher.decrypt(alterado)).toThrow();
    });

    it('rechaza el descifrado con una clave que no es la suya', () => {
      const cifrado = cipherCon(`v1:${key()}`).encrypt('dato');

      // Mismo identificador, clave distinta: GCM lo detecta por el auth tag.
      const impostor = cipherCon(`v1:${key()}`);

      expect(() => impostor.decrypt(cifrado)).toThrow();
    });
  });

  describe('sin clave configurada', () => {
    const sinClave = new FieldCipher(null, VARIABLE);

    it('avisa de que no está lista', () => {
      expect(sinClave.isReady()).toBe(false);
    });

    it('falla al cifrar nombrando la variable', () => {
      expect(() => sinClave.encrypt('dato')).toThrow(
        /SISCOUT_ENCRYPTION_KEY no está configurada/,
      );
    });

    it('falla al descifrar nombrando la variable', () => {
      const cifrado = cipherCon(key()).encrypt('dato');

      expect(() => sinClave.decrypt(cifrado)).toThrow(
        /SISCOUT_ENCRYPTION_KEY no está configurada/,
      );
    });
  });
});

describe('isEncrypted', () => {
  it('reconoce un valor cifrado', () => {
    expect(isEncrypted(cipherCon(key()).encrypt('dato'))).toBe(true);
  });

  it('descarta valores en claro, nulos y objetos ajenos', () => {
    expect(isEncrypted('1013599123')).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
    expect(isEncrypted({ iv: 'x', tag: 'y', data: 'z' })).toBe(false);
  });
});
