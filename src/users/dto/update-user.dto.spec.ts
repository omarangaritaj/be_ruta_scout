import { createUserSchema } from './create-user.dto';
import { NIVELES_OTORGABLES, updateUserSchema } from './update-user.dto';

const aceptaNivel = (nivelAcceso: string) =>
  updateUserSchema.safeParse({ nivelAcceso }).success;

describe('updateUserSchema.nivelAcceso', () => {
  it('acepta los cuatro niveles territoriales', () => {
    for (const nivel of NIVELES_OTORGABLES) {
      expect(aceptaNivel(nivel)).toBe(true);
    }
  });

  /**
   * `super_admin` no es otorgable por API: `NIVELES_OTORGABLES` es `ROLE_LEVELS`
   * y ese arreglo no lo incluye. Es una defensa que ya existía y que este test
   * fija: añadirlo a la lista abriría la puerta a concederlo por PATCH.
   */
  it('NO acepta super_admin: no se concede desde el panel', () => {
    expect(aceptaNivel('super_admin')).toBe(false);
    expect(NIVELES_OTORGABLES).not.toContain('super_admin');
  });

  it('tampoco acepta un nivel inventado', () => {
    expect(aceptaNivel('emperador')).toBe(false);
  });
});

describe('createUserSchema', () => {
  it('no admite nivelAcceso: crear una persona no le fija nivel', () => {
    const parsed = createUserSchema.parse({
      tipo: 'adulto',
      name: 'Ana',
      idSiscout: '123',
      nivelAcceso: 'nacion',
    });

    expect(parsed).not.toHaveProperty('nivelAcceso');
  });
});
