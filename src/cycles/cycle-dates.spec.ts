import { hasValidRange } from './cycle-dates';

describe('hasValidRange', () => {
  it('acepta un fin posterior al inicio', () => {
    expect(hasValidRange(new Date('2026-01-01'), new Date('2026-03-31'))).toBe(
      true,
    );
  });

  it('rechaza un fin anterior al inicio', () => {
    expect(hasValidRange(new Date('2026-03-31'), new Date('2026-01-01'))).toBe(
      false,
    );
  });

  it('rechaza fechas iguales', () => {
    expect(hasValidRange(new Date('2026-01-01'), new Date('2026-01-01'))).toBe(
      false,
    );
  });
});
