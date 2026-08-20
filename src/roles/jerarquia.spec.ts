import {
  ancestrosDeHijo,
  creaCiclo,
  enSubarbolDe,
  nivelDeHijo,
  puedeColgarDe,
  relinajar,
  type PadreRol,
} from './jerarquia';

/**
 * El árbol decide quién gestiona y asigna qué, así que lo que hay que blindar
 * es el borde: la rama hermana NO es mía, mi propio padre TAMPOCO, y mi propio
 * rol SÍ (se concede lo que se tiene).
 */
describe('jerarquía de roles', () => {
  const SUPER = 'aaaaaaaa-0000-4000-8000-000000000001';
  const COORDINADOR = 'bbbbbbbb-0000-4000-8000-000000000002';
  const APROBADOR = 'cccccccc-0000-4000-8000-000000000003';
  const REVISOR = 'dddddddd-0000-4000-8000-000000000004';
  const DOCUMENTACION = 'eeeeeeee-0000-4000-8000-000000000005';

  // super_admin
  //   ├── coordinador
  //   │     └── aprobador
  //   │           └── revisor
  //   └── documentación
  const coordinador = { id: COORDINADOR, ancestros: [SUPER] };
  const aprobador = { id: APROBADOR, ancestros: [SUPER, COORDINADOR] };
  const revisor = { id: REVISOR, ancestros: [SUPER, COORDINADOR, APROBADOR] };
  const documentacion = { id: DOCUMENTACION, ancestros: [SUPER] };
  const superAdmin = { id: SUPER, ancestros: [] };

  describe('nivelDeHijo', () => {
    it('sin padre es raíz', () => {
      expect(nivelDeHijo(null)).toBe(0);
    });

    it('cada generación suma uno', () => {
      const padre: PadreRol = { id: COORDINADOR, nivel: 1, ancestros: [SUPER] };

      expect(nivelDeHijo(padre)).toBe(2);
    });
  });

  describe('ancestrosDeHijo', () => {
    it('la raíz no tiene linaje', () => {
      expect(ancestrosDeHijo(null)).toEqual([]);
    });

    it('hereda el linaje del padre y le añade el padre, raíz primero', () => {
      const padre: PadreRol = {
        id: APROBADOR,
        nivel: 2,
        ancestros: [SUPER, COORDINADOR],
      };

      expect(ancestrosDeHijo(padre)).toEqual([SUPER, COORDINADOR, APROBADOR]);
    });

    it('el nivel siempre coincide con la longitud del linaje', () => {
      const padre: PadreRol = { id: COORDINADOR, nivel: 1, ancestros: [SUPER] };

      expect(nivelDeHijo(padre)).toBe(ancestrosDeHijo(padre).length);
    });
  });

  describe('enSubarbolDe', () => {
    it('un descendiente directo es mío', () => {
      expect(enSubarbolDe(aprobador, [COORDINADOR])).toBe(true);
    });

    it('un nieto también', () => {
      expect(enSubarbolDe(revisor, [COORDINADOR])).toBe(true);
    });

    it('mi propio rol es mío: se concede lo que se tiene', () => {
      expect(enSubarbolDe(coordinador, [COORDINADOR])).toBe(true);
    });

    it('la rama hermana NO es mía', () => {
      expect(enSubarbolDe(documentacion, [COORDINADOR])).toBe(false);
    });

    it('mi propio padre NO es mío', () => {
      expect(enSubarbolDe(superAdmin, [COORDINADOR])).toBe(false);
    });

    it('la raíz alcanza todo el árbol', () => {
      for (const rol of [coordinador, aprobador, revisor, documentacion]) {
        expect(enSubarbolDe(rol, [SUPER])).toBe(true);
      }
    });

    it('con varios roles vale la unión de sus subárboles', () => {
      expect(enSubarbolDe(documentacion, [APROBADOR, DOCUMENTACION])).toBe(
        true,
      );
      expect(enSubarbolDe(revisor, [APROBADOR, DOCUMENTACION])).toBe(true);
    });

    it('sin roles no se alcanza nada', () => {
      expect(enSubarbolDe(revisor, [])).toBe(false);
    });
  });

  describe('puedeColgarDe', () => {
    it('se cuelga de un rol propio', () => {
      expect(puedeColgarDe(coordinador, [COORDINADOR, DOCUMENTACION])).toBe(
        true,
      );
    });

    it('se cuelga de un descendiente propio: el árbol tiene que poder crecer', () => {
      // Sin esto la raíz solo podría crear hijos directos y tendría que
      // auto-asignarse cada rol nuevo para bajar un nivel más.
      expect(puedeColgarDe(revisor, [COORDINADOR])).toBe(true);
    });

    it('NO se cuelga de la rama hermana', () => {
      expect(puedeColgarDe(documentacion, [COORDINADOR])).toBe(false);
    });

    it('NO se cuelga del rol del jefe: ahí estaría la escalada', () => {
      expect(puedeColgarDe(superAdmin, [COORDINADOR])).toBe(false);
    });
  });
});

/**
 * Recolgar es la operación peligrosa del árbol: un ciclo lo deja sin raíz y
 * un linaje mal recalculado le cambia el dueño a media organización en
 * silencio.
 */
describe('recolgar un rol', () => {
  const SUPER = 'aaaaaaaa-0000-4000-8000-000000000001';
  const COORDINADOR = 'bbbbbbbb-0000-4000-8000-000000000002';
  const APROBADOR = 'cccccccc-0000-4000-8000-000000000003';
  const REVISOR = 'dddddddd-0000-4000-8000-000000000004';
  const DOCUMENTACION = 'eeeeeeee-0000-4000-8000-000000000005';

  const coordinador = { id: COORDINADOR, ancestros: [SUPER] };
  const aprobador = { id: APROBADOR, ancestros: [SUPER, COORDINADOR] };
  const revisor = { id: REVISOR, ancestros: [SUPER, COORDINADOR, APROBADOR] };
  const documentacion = { id: DOCUMENTACION, ancestros: [SUPER] };

  describe('creaCiclo', () => {
    it('no se cuelga de sí mismo', () => {
      expect(creaCiclo(coordinador, coordinador)).toBe(true);
    });

    it('no se cuelga de un hijo suyo', () => {
      expect(creaCiclo(coordinador, aprobador)).toBe(true);
    });

    it('no se cuelga de un nieto suyo', () => {
      expect(creaCiclo(coordinador, revisor)).toBe(true);
    });

    it('sí se cuelga de una rama hermana', () => {
      expect(creaCiclo(coordinador, documentacion)).toBe(false);
    });

    it('sí puede subir: colgarse de su propio abuelo', () => {
      expect(creaCiclo(revisor, coordinador)).toBe(false);
    });
  });

  describe('relinajar', () => {
    it('reescribe solo el prefijo, conservando el tramo de abajo', () => {
      // aprobador (linaje [super, coordinador], largo 2) pasa a colgar de
      // documentación: su nuevo linaje es [super, documentacion].
      const nuevo = relinajar(revisor, 2, [SUPER, DOCUMENTACION]);

      // revisor conserva su tramo bajo aprobador.
      expect(nuevo).toEqual([SUPER, DOCUMENTACION, APROBADOR]);
    });

    it('el nivel del descendiente sigue siendo la longitud de su linaje', () => {
      const nuevo = relinajar(revisor, 2, [SUPER, DOCUMENTACION]);

      expect(nuevo.length).toBe(3);
    });

    it('subir de nivel al ancestro acorta a toda la descendencia', () => {
      // aprobador se cuelga directo de la raíz: linaje nuevo [super].
      const nuevo = relinajar(revisor, 2, [SUPER]);

      expect(nuevo).toEqual([SUPER, APROBADOR]);
    });
  });
});
