import { isPlanningLocked } from './planning-lock';

describe('isPlanningLocked', () => {
  it('está abierto mientras el ciclo sea borrador', () => {
    expect(isPlanningLocked({})).toBe(false);
  });

  it('está abierto con activatedAt en null', () => {
    expect(isPlanningLocked({ activatedAt: null })).toBe(false);
  });

  it('está cerrado una vez activado', () => {
    expect(isPlanningLocked({ activatedAt: new Date('2026-02-01') })).toBe(
      true,
    );
  });
});
