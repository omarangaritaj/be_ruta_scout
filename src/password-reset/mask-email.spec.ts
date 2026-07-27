import { maskEmail } from './mask-email';

describe('maskEmail', () => {
  it('deja ver las dos primeras letras y el dominio completo', () => {
    expect(maskEmail('omar.angarita@expo.red')).toBe('om•••@expo.red');
  });

  it('con un local corto solo deja ver la primera letra', () => {
    expect(maskEmail('ab@scout.org.co')).toBe('a•••@scout.org.co');
    expect(maskEmail('a@scout.org.co')).toBe('a•••@scout.org.co');
  });

  it('usa la última arroba para separar local y dominio', () => {
    expect(maskEmail('raro@interno@scout.org.co')).toBe('ra•••@scout.org.co');
  });

  it('sin arroba utilizable no revela nada', () => {
    expect(maskEmail('no-es-un-correo')).toBe('•••');
    expect(maskEmail('@scout.org.co')).toBe('•••');
    expect(maskEmail('')).toBe('•••');
  });
});
