import { randomBytes } from 'node:crypto';
import { FieldCipher, isEncrypted, parseKeyring } from '../../crypto';
import { canonicalHash } from '../hash/canonical-hash';
import type { SiscoutMember } from '../normalize';
import {
  ENCRYPTED_FIELDS,
  decryptSensitiveFields,
  encryptSensitiveFields,
} from './encrypted-fields';

const VARIABLE = 'SISCOUT_ENCRYPTION_KEY';

function nuevoCipher(): FieldCipher {
  return new FieldCipher(
    parseKeyring(randomBytes(32).toString('base64'), VARIABLE),
    VARIABLE,
  );
}

/** Miembro completo, con todos los campos poblados. */
function miembro(overrides: Partial<SiscoutMember> = {}): SiscoutMember {
  return {
    person_id: '176035',
    citizenship_card: '1013599123',
    nombre: 'Andrés Muñoz',
    sex: 'M',
    telefono: '3001234567',
    email: 'andres@ejemplo.org',
    cargo: 'JEFE DE GRUPO',
    cargo_id: null,
    tipomiembro: 'MIEMBRO ACTIVO ADULTO',
    group_id: 42,
    group_name: 'Grupo 42',
    district_id: 8,
    district_name: 'Distrito 8',
    zone_id: 1,
    ...overrides,
  };
}

describe('encryptSensitiveFields', () => {
  it('cifra exactamente la cédula, el teléfono y el correo', () => {
    const payload = encryptSensitiveFields(miembro(), nuevoCipher());

    expect(isEncrypted(payload.citizenship_card)).toBe(true);
    expect(isEncrypted(payload.telefono)).toBe(true);
    expect(isEncrypted(payload.email)).toBe(true);
  });

  it('deja en claro los campos que el motor lee sin descifrar', () => {
    const original = miembro();

    const payload = encryptSensitiveFields(original, nuevoCipher());

    // `cargo` y `group_id` los compara la detección de cambios contra el
    // snapshot anterior; `nombre` ya se proyecta a `users.name`. Cifrarlos no
    // aportaría confidencialidad y sí rompería esas lecturas.
    expect(payload.cargo).toBe(original.cargo);
    expect(payload.group_id).toBe(original.group_id);
    expect(payload.nombre).toBe(original.nombre);
    expect(payload.person_id).toBe(original.person_id);
    expect(payload.zone_id).toBe(original.zone_id);
  });

  it('no deja rastro del valor original en el payload cifrado', () => {
    const original = miembro();

    const payload = encryptSensitiveFields(original, nuevoCipher());

    const serializado = JSON.stringify(payload);
    expect(serializado).not.toContain('1013599123');
    expect(serializado).not.toContain('3001234567');
    expect(serializado).not.toContain('andres@ejemplo.org');
  });

  it('no muta el miembro recibido', () => {
    const original = miembro();

    encryptSensitiveFields(original, nuevoCipher());

    expect(original.citizenship_card).toBe('1013599123');
    expect(original.telefono).toBe('3001234567');
    expect(original.email).toBe('andres@ejemplo.org');
  });

  it('deja los nulos tal cual, sin cifrar el hueco', () => {
    const sinDatos = miembro({
      citizenship_card: null,
      telefono: null,
      email: null,
    });

    const payload = encryptSensitiveFields(sinDatos, nuevoCipher());

    expect(payload.citizenship_card).toBeNull();
    expect(payload.telefono).toBeNull();
    expect(payload.email).toBeNull();
  });

  it('deja la cadena vacía tal cual', () => {
    const payload = encryptSensitiveFields(
      miembro({ telefono: '' }),
      nuevoCipher(),
    );

    expect(payload.telefono).toBe('');
  });

  it('falla sin clave en lugar de guardar la PII en claro', () => {
    const sinClave = new FieldCipher(null, VARIABLE);

    expect(() => encryptSensitiveFields(miembro(), sinClave)).toThrow(
      /SISCOUT_ENCRYPTION_KEY no está configurada/,
    );
  });
});

describe('decryptSensitiveFields', () => {
  it('devuelve el miembro original tras el viaje de ida y vuelta', () => {
    const cipher = nuevoCipher();
    const original = miembro();

    const recuperado = decryptSensitiveFields(
      encryptSensitiveFields(original, cipher),
      cipher,
    );

    expect(recuperado).toEqual(original);
  });

  it('deja intacto lo que ya viene en claro', () => {
    const cipher = nuevoCipher();

    // Documento anterior al cifrado: nada que descifrar, nada que romper.
    const enClaro = { ...miembro() } as Record<string, unknown>;

    expect(decryptSensitiveFields(enClaro, cipher)).toEqual(enClaro);
  });

  it('descifra un payload cifrado solo a medias', () => {
    const cipher = nuevoCipher();

    const mixto = {
      ...miembro(),
      citizenship_card: cipher.encrypt('1013599123'),
      // Teléfono y correo se quedaron en claro por lo que sea.
    } as Record<string, unknown>;

    const recuperado = decryptSensitiveFields(mixto, cipher);

    expect(recuperado.citizenship_card).toBe('1013599123');
    expect(recuperado.telefono).toBe('3001234567');
  });

  it('no muta el payload recibido', () => {
    const cipher = nuevoCipher();
    const payload = encryptSensitiveFields(miembro(), cipher);

    decryptSensitiveFields(payload, cipher);

    expect(isEncrypted(payload.citizenship_card)).toBe(true);
  });
});

describe('orden de las operaciones: primero hashear, después cifrar', () => {
  it('el mismo miembro produce payloads cifrados distintos', () => {
    const cipher = nuevoCipher();
    const original = miembro();

    const primero = encryptSensitiveFields(original, cipher);
    const segundo = encryptSensitiveFields(original, cipher);

    // AES-GCM usa un IV aleatorio por operación. Si el hash del snapshot se
    // calculara sobre el payload CIFRADO, cambiaría en cada corrida y el motor
    // reescribiría la colección entera cada noche creyendo que todo cambió.
    expect(primero.citizenship_card).not.toEqual(segundo.citizenship_card);
  });

  it('el hash sobre el texto plano sí es estable', () => {
    const original = miembro();

    expect(canonicalHash(original)).toBe(canonicalHash(miembro()));
  });
});

describe('ENCRYPTED_FIELDS', () => {
  it('es la lista de permitidos que consume el cifrado', () => {
    // Si alguien añade un campo aquí, el round-trip de arriba lo cubre solo.
    expect(ENCRYPTED_FIELDS).toEqual(['citizenship_card', 'telefono', 'email']);
  });
});
