/**
 * Enmascara un correo para devolverlo al cliente: `omar.angarita@expo.red` →
 * `om•••@expo.red`.
 *
 * El dominio va completo a propósito. La persona pidió recuperar su contraseña
 * por cédula y no necesariamente recuerda con qué correo quedó afiliada en
 * SiScout; ver el dominio le basta para saber en qué buzón buscar, o para
 * darse cuenta de que su correo está desactualizado y hay que corregirlo allá.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '•••';

  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);

  return `${visible}•••${domain}`;
}
