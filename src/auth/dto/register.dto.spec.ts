import { registerSchema } from './register.dto';

const valida = (password: string) =>
  registerSchema.safeParse({ cedula: '123', password }).success;

describe('registerSchema.password', () => {
  it('exige al menos 8 caracteres', () => {
    expect(valida('corta12')).toBe(false);
    expect(valida('correcta')).toBe(true);
  });

  it('acepta 72 bytes exactos', () => {
    expect(valida('a'.repeat(72))).toBe(true);
  });

  it('rechaza lo que pase de 72 bytes', () => {
    expect(valida('a'.repeat(73))).toBe(false);
  });

  it('cuenta bytes y no caracteres en el texto acentuado', () => {
    const acentuada = 'ñ'.repeat(37);
    expect(acentuada).toHaveLength(37);
    expect(Buffer.byteLength(acentuada, 'utf8')).toBe(74);
    expect(valida(acentuada)).toBe(false);
  });

  it('cuenta bytes y no caracteres en los emojis', () => {
    const conEmojis = '🛡️'.repeat(12);
    expect(Buffer.byteLength(conEmojis, 'utf8')).toBeGreaterThan(72);
    expect(valida(conEmojis)).toBe(false);
  });
});
