import { allAnswered, isNo, isUnanswered, isYes } from './answers';

describe('answers', () => {
  it('distingue el sí', () => {
    expect(isYes(true)).toBe(true);
    expect(isYes(false)).toBe(false);
    expect(isYes(null)).toBe(false);
  });

  it('distingue el no de la falta de respuesta', () => {
    expect(isNo(false)).toBe(true);
    expect(isNo(null)).toBe(false);
    expect(isNo(true)).toBe(false);
  });

  it('reconoce la falta de respuesta', () => {
    expect(isUnanswered(null)).toBe(true);
    expect(isUnanswered(false)).toBe(false);
    expect(isUnanswered(true)).toBe(false);
  });

  it('acepta un conjunto respondido aunque todo sea no', () => {
    expect(allAnswered([false, false, false, false])).toBe(true);
  });

  it('rechaza un conjunto con alguna sin responder', () => {
    expect(allAnswered([true, false, null, true])).toBe(false);
  });

  it('acepta el conjunto vacío', () => {
    expect(allAnswered([])).toBe(true);
  });
});
