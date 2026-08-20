import { riskLevel, riskRating } from './risk-level';

describe('riskLevel', () => {
  it('multiplica probabilidad por consecuencia', () => {
    expect(riskLevel(3, 4)).toBe(12);
    expect(riskLevel(1, 1)).toBe(1);
    expect(riskLevel(5, 5)).toBe(25);
  });
});

describe('riskRating', () => {
  it('clasifica bajo hasta 5', () => {
    expect(riskRating(1)).toBe('bajo');
    expect(riskRating(5)).toBe('bajo');
  });

  it('clasifica medio de 6 a 10', () => {
    expect(riskRating(6)).toBe('medio');
    expect(riskRating(10)).toBe('medio');
  });

  it('clasifica alto de 11 a 15', () => {
    expect(riskRating(11)).toBe('alto');
    expect(riskRating(15)).toBe('alto');
  });

  it('clasifica crítico por encima de 15', () => {
    expect(riskRating(16)).toBe('critico');
    expect(riskRating(25)).toBe('critico');
  });
});
