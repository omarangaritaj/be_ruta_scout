import {
  DEFAULT_EMAIL_DOMAIN,
  anonymizeMember,
  anonymizeSample,
  anonymizedEmail,
  anonymizedPhone,
  findLeaks,
  type RawMember,
  type SiscoutSample,
} from './anonymizer';

function rawMember(overrides: RawMember = {}): RawMember {
  return {
    person_id: 176035,
    code: '430176035',
    nombre: ' ANDRES  MUNOZ RAMIREZ ',
    cedula: '1013599123',
    citizenship_card: '1013599123',
    telefono: '3001234567',
    email: 'andres@ejemplo.org',
    tipomiembro: 'MIEMBRO ACTIVO ADULTO',
    grupo: '#42 - GRUPO DE PRUEBA',
    group_id: 42,
    accion:
      "<a href=\"javascript:generarUsuario('176035','andres@ejemplo.org');\">Resetear Clave</a>",
    acciones:
      "<a href=\"javascript:generarUsuario('176035','andres@ejemplo.org');\">Resetear Clave</a>",
    ...overrides,
  };
}

function sample(members: RawMember[]): SiscoutSample {
  return {
    respuesta_raw: { data: members, recordsTotal: 10863 },
  } as SiscoutSample;
}

describe('dominio de correo', () => {
  it('usa test.com mientras no se pida otro', () => {
    expect(DEFAULT_EMAIL_DOMAIN).toBe('test.com');
    expect(anonymizedEmail('176035')).toBe('176035@test.com');
    expect(anonymizeMember(rawMember()).email).toBe('176035@test.com');
  });

  it('respeta el dominio recibido en el campo email', () => {
    expect(anonymizedEmail('176035', 'demo.expo.red')).toBe(
      '176035@demo.expo.red',
    );
    expect(anonymizeMember(rawMember(), 'demo.expo.red').email).toBe(
      '176035@demo.expo.red',
    );
  });

  it('respeta el dominio también en los correos incrustados', () => {
    const anonymized = anonymizeMember(rawMember(), 'demo.expo.red');

    expect(anonymized.accion).toContain('176035@demo.expo.red');
    expect(JSON.stringify(anonymized)).not.toContain('test.com');
  });

  it('propaga el dominio a todos los registros del volcado', () => {
    const anonymized = anonymizeSample(
      sample([rawMember(), rawMember({ person_id: 200 })]),
      'demo.expo.red',
    );
    const data = anonymized.respuesta_raw?.data as RawMember[];

    expect(data.map((member) => member.email)).toEqual([
      '176035@demo.expo.red',
      '200@demo.expo.red',
    ]);
  });

  it('no confunde el índice del recorrido con el dominio', () => {
    const anonymized = anonymizeSample(
      sample([rawMember({ person_id: 1 }), rawMember({ person_id: 2 })]),
    );
    const data = anonymized.respuesta_raw?.data as RawMember[];

    expect(data[1].email).toBe('2@test.com');
  });
});

describe('anonymizedPhone', () => {
  it('produce diez dígitos que empiezan en 3 y terminan en el idSiscout', () => {
    const phone = anonymizedPhone('176035');

    expect(phone).toBe('3000176035');
    expect(phone).toHaveLength(10);
  });

  it('rellena con ceros los identificadores cortos', () => {
    expect(anonymizedPhone('7')).toBe('3000000007');
  });

  it('conserva los últimos nueve dígitos de un identificador demasiado largo', () => {
    expect(anonymizedPhone('12345678901')).toBe('3345678901');
    expect(anonymizedPhone('12345678901')).toHaveLength(10);
  });

  it('descarta lo que no sea dígito', () => {
    expect(anonymizedPhone('mock-nacion-001')).toBe('3000000001');
  });
});

describe('anonymizeMember', () => {
  it('sustituye el correo por idSiscout@test.com', () => {
    expect(anonymizeMember(rawMember()).email).toBe('176035@test.com');
  });

  it('sustituye el documento por el idSiscout en ambos campos', () => {
    const anonymized = anonymizeMember(rawMember());

    expect(anonymized.citizenship_card).toBe('176035');
    expect(anonymized.cedula).toBe('176035');
  });

  it('sustituye el teléfono por un móvil de diez dígitos en texto', () => {
    const telefono = anonymizeMember(rawMember()).telefono;

    expect(telefono).toBe('3000176035');
    expect(typeof telefono).toBe('string');
  });

  it('limpia también el correo incrustado en el HTML de las acciones', () => {
    const anonymized = anonymizeMember(rawMember());

    expect(anonymized.accion).toContain('176035@test.com');
    expect(anonymized.acciones).toContain('176035@test.com');
    expect(JSON.stringify(anonymized)).not.toContain('ejemplo.org');
  });

  it('no deja rastro de ningún valor original en el registro', () => {
    const serialized = JSON.stringify(anonymizeMember(rawMember()));

    expect(serialized).not.toContain('1013599123');
    expect(serialized).not.toContain('3001234567');
    expect(serialized).not.toContain('andres@ejemplo.org');
  });

  it('conserva intactos los campos que no son datos personales', () => {
    const anonymized = anonymizeMember(rawMember());

    expect(anonymized.person_id).toBe(176035);
    expect(anonymized.nombre).toBe(' ANDRES  MUNOZ RAMIREZ ');
    expect(anonymized.grupo).toBe('#42 - GRUPO DE PRUEBA');
    expect(anonymized.group_id).toBe(42);
    expect(anonymized.code).toBe('430176035');
  });

  it('deja los huecos como huecos en lugar de inventar datos', () => {
    const anonymized = anonymizeMember(
      rawMember({ telefono: null, email: '', cedula: undefined }),
    );

    expect(anonymized.telefono).toBeNull();
    expect(anonymized.email).toBe('');
    expect(anonymized.cedula).toBeUndefined();
  });

  it('barre cualquier correo suelto aunque el campo email venga vacío', () => {
    const anonymized = anonymizeMember(
      rawMember({ email: null, accion: 'contacto: otro@dominio.org' }),
    );

    expect(anonymized.accion).toBe('contacto: 176035@test.com');
  });

  it('acepta el person_id venga como número o como texto', () => {
    expect(anonymizeMember(rawMember({ person_id: '176035' })).email).toBe(
      '176035@test.com',
    );
  });

  it('no muta el registro recibido', () => {
    const original = rawMember();

    anonymizeMember(original);

    expect(original.email).toBe('andres@ejemplo.org');
    expect(original.citizenship_card).toBe('1013599123');
  });

  it('falla en lugar de emitir un registro sin identificador con el que sustituir', () => {
    expect(() => anonymizeMember(rawMember({ person_id: null }))).toThrow(
      /sin person_id/,
    );
  });
});

describe('anonymizeSample', () => {
  it('anonimiza todos los registros y conserva el resto del volcado', () => {
    const original = sample([
      rawMember(),
      rawMember({
        person_id: 200,
        email: 'otro@ejemplo.org',
        cedula: '99887766',
        citizenship_card: '99887766',
        telefono: '3117654321',
        accion: 'sin correo',
        acciones: 'sin correo',
      }),
    ]);

    const anonymized = anonymizeSample(original);
    const data = anonymized.respuesta_raw?.data as RawMember[];

    expect(data).toHaveLength(2);
    expect(data[0].email).toBe(anonymizedEmail('176035'));
    expect(data[1].email).toBe(anonymizedEmail('200'));
    expect(data[1].telefono).toBe('3000000200');
    expect(
      (anonymized.respuesta_raw as { recordsTotal: number }).recordsTotal,
    ).toBe(10863);
  });

  it('no muta el volcado recibido', () => {
    const original = sample([rawMember()]);

    anonymizeSample(original);

    expect((original.respuesta_raw?.data?.[0] as RawMember).email).toBe(
      'andres@ejemplo.org',
    );
  });

  it('rechaza un archivo que no sea un volcado de SiScout', () => {
    expect(() => anonymizeSample({})).toThrow(/respuesta_raw\.data/);
  });
});

describe('findLeaks', () => {
  it('no encuentra nada cuando la anonimización fue completa', () => {
    const original = sample([rawMember()]);

    expect(findLeaks(original, anonymizeSample(original))).toEqual([]);
  });

  it('delata el valor sensible que sobrevivió', () => {
    const original = sample([rawMember()]);
    const manipulado = sample([
      { ...rawMember(), email: '176035@test.com', telefono: '3001234567' },
    ]);

    expect(findLeaks(original, manipulado)).toContain('3001234567');
  });
});
