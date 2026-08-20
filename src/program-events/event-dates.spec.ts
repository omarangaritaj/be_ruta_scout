import {
  diffInDays,
  isDayWithin,
  isSingleDay,
  isWithinCycle,
  overlaps,
  shiftDay,
  toMidnightUTC,
} from './event-dates';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('isSingleDay', () => {
  it('acepta inicio y fin el mismo día', () => {
    expect(isSingleDay(d('2026-08-18'), d('2026-08-18'))).toBe(true);
  });

  it('rechaza un rango de varios días', () => {
    expect(isSingleDay(d('2026-08-18'), d('2026-08-20'))).toBe(false);
  });
});

describe('isWithinCycle', () => {
  const inicio = d('2026-03-01');
  const fin = d('2026-06-30');

  it('acepta un evento contenido en el ciclo', () => {
    expect(isWithinCycle(d('2026-04-10'), d('2026-04-12'), inicio, fin)).toBe(
      true,
    );
  });

  it('acepta un evento que toca los extremos', () => {
    expect(isWithinCycle(inicio, fin, inicio, fin)).toBe(true);
  });

  it('rechaza un evento que empieza antes', () => {
    expect(isWithinCycle(d('2026-02-28'), d('2026-03-02'), inicio, fin)).toBe(
      false,
    );
  });

  it('rechaza un evento que termina después', () => {
    expect(isWithinCycle(d('2026-06-29'), d('2026-07-01'), inicio, fin)).toBe(
      false,
    );
  });
});

describe('toMidnightUTC', () => {
  it('descarta la hora', () => {
    expect(
      toMidnightUTC(new Date('2026-08-18T17:43:22.500Z')).toISOString(),
    ).toBe('2026-08-18T00:00:00.000Z');
  });

  it('deja igual una fecha que ya está a medianoche', () => {
    expect(toMidnightUTC(d('2026-08-18')).toISOString()).toBe(
      '2026-08-18T00:00:00.000Z',
    );
  });

  it('no corre el día con una hora tardía', () => {
    expect(
      toMidnightUTC(new Date('2026-08-18T23:59:59.999Z')).toISOString(),
    ).toBe('2026-08-18T00:00:00.000Z');
  });
});

describe('overlaps', () => {
  it('detecta solape parcial', () => {
    expect(
      overlaps(
        d('2026-09-12'),
        d('2026-09-14'),
        d('2026-09-13'),
        d('2026-09-15'),
      ),
    ).toBe(true);
  });

  it('detecta contención', () => {
    expect(
      overlaps(
        d('2026-09-12'),
        d('2026-09-16'),
        d('2026-09-13'),
        d('2026-09-14'),
      ),
    ).toBe(true);
  });

  it('detecta el caso de un solo día compartido', () => {
    expect(
      overlaps(
        d('2026-09-14'),
        d('2026-09-14'),
        d('2026-09-12'),
        d('2026-09-14'),
      ),
    ).toBe(true);
  });

  it('no marca solape cuando son consecutivos sin tocarse', () => {
    expect(
      overlaps(
        d('2026-09-12'),
        d('2026-09-13'),
        d('2026-09-14'),
        d('2026-09-15'),
      ),
    ).toBe(false);
  });
});

describe('isDayWithin', () => {
  const inicio = d('2026-09-12');
  const fin = d('2026-09-14');

  it('acepta un día interior', () => {
    expect(isDayWithin('2026-09-13', inicio, fin)).toBe(true);
  });

  it('acepta los extremos', () => {
    expect(isDayWithin('2026-09-12', inicio, fin)).toBe(true);
    expect(isDayWithin('2026-09-14', inicio, fin)).toBe(true);
  });

  it('rechaza un día anterior o posterior', () => {
    expect(isDayWithin('2026-09-11', inicio, fin)).toBe(false);
    expect(isDayWithin('2026-09-15', inicio, fin)).toBe(false);
  });

  it('rechaza una cadena que no es una fecha', () => {
    expect(isDayWithin('no-es-fecha', inicio, fin)).toBe(false);
  });

  it('rechaza un 30 de febrero aunque "ruede" a un día dentro del rango', () => {
    expect(isDayWithin('2026-02-30', d('2026-02-25'), d('2026-03-05'))).toBe(
      false,
    );
  });

  it('rechaza un 31 de abril aunque "ruede" a un día dentro del rango', () => {
    expect(isDayWithin('2026-04-31', d('2026-04-20'), d('2026-05-05'))).toBe(
      false,
    );
  });

  it('sigue aceptando un 28 de febrero válido', () => {
    expect(isDayWithin('2026-02-28', d('2026-02-25'), d('2026-03-05'))).toBe(
      true,
    );
  });

  it('acepta el 29 de febrero en un año bisiesto', () => {
    expect(isDayWithin('2028-02-29', d('2028-02-25'), d('2028-03-05'))).toBe(
      true,
    );
  });
});

// El delta que `reschedule` aplica a cada momento de la agenda
// cuando el evento se mueve.
describe('diffInDays', () => {
  it('cuenta días hacia adelante', () => {
    expect(diffInDays(d('2026-04-10'), d('2026-04-17'))).toBe(7);
  });

  it('cuenta días hacia atrás como negativo', () => {
    expect(diffInDays(d('2026-04-17'), d('2026-04-10'))).toBe(-7);
  });

  it('sin movimiento, da cero', () => {
    expect(diffInDays(d('2026-04-10'), d('2026-04-10'))).toBe(0);
  });

  it('ignora la hora del día: solo cuenta días completos a medianoche UTC', () => {
    expect(
      diffInDays(
        new Date('2026-04-10T23:00:00.000Z'),
        new Date('2026-04-11T01:00:00.000Z'),
      ),
    ).toBe(1);
  });
});

describe('shiftDay', () => {
  it('mueve el día hacia adelante', () => {
    expect(shiftDay('2026-04-10', 7)).toBe('2026-04-17');
  });

  it('mueve el día hacia atrás con delta negativo', () => {
    expect(shiftDay('2026-04-17', -7)).toBe('2026-04-10');
  });

  it('con delta cero, deja el día igual', () => {
    expect(shiftDay('2026-04-10', 0)).toBe('2026-04-10');
  });

  it('cruza el límite de mes correctamente', () => {
    expect(shiftDay('2026-04-28', 5)).toBe('2026-05-03');
  });

  it('un día que no parsea se devuelve tal cual, sin lanzar', () => {
    expect(shiftDay('no-es-fecha', 5)).toBe('no-es-fecha');
  });
});
