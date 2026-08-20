import { SISCOUT_CONFIG_GROUP } from '../siscout/config/siscout-config.catalog';
import { buildValueSchema } from './runtime-config.validation';

describe('buildValueSchema', () => {
  describe('number', () => {
    it('respeta los límites que trae el registro', () => {
      const schema = buildValueSchema('number', { min: 1, max: 100 });

      expect(schema.safeParse(50).success).toBe(true);
      expect(schema.safeParse(0).success).toBe(false);
      expect(schema.safeParse(101).success).toBe(false);
    });

    it('rechaza decimales cuando se exige entero', () => {
      const schema = buildValueSchema('number', { integer: true });

      expect(schema.safeParse(4000).success).toBe(true);
      expect(schema.safeParse(4000.5).success).toBe(false);
    });

    it('sin límites acepta cualquier número', () => {
      const schema = buildValueSchema('number');

      expect(schema.safeParse(-99).success).toBe(true);
    });
  });

  describe('cron', () => {
    it('acepta una expresión válida y rechaza la que no lo es', () => {
      const schema = buildValueSchema('cron');

      expect(schema.safeParse('0 3 * * *').success).toBe(true);
      expect(schema.safeParse('basura').success).toBe(false);
      expect(schema.safeParse('').success).toBe(false);
    });
  });

  describe('number[]', () => {
    it('exige el mínimo de elementos declarado', () => {
      const schema = buildValueSchema('number[]', { minItems: 1 });

      expect(schema.safeParse([1, 2]).success).toBe(true);
      expect(schema.safeParse([]).success).toBe(false);
    });

    it('aplica los límites a CADA elemento, no al arreglo', () => {
      const schema = buildValueSchema('number[]', { min: 1, integer: true });

      expect(schema.safeParse([1, 5]).success).toBe(true);
      expect(schema.safeParse([1, 0]).success).toBe(false);
      expect(schema.safeParse([1, 2.5]).success).toBe(false);
    });

    it('deduplica cuando el registro lo pide', () => {
      const schema = buildValueSchema('number[]', { unique: true });

      expect(schema.parse([1, 1, 2, 2, 3])).toEqual([1, 2, 3]);
    });
  });

  describe('select', () => {
    it('solo acepta los valores declarados en las opciones', () => {
      const schema = buildValueSchema('select', {
        options: [
          { value: 'diario', label: 'Diario' },
          { value: 'semanal', label: 'Semanal' },
        ],
      });

      expect(schema.safeParse('diario').success).toBe(true);
      expect(schema.safeParse('mensual').success).toBe(false);
    });
  });

  describe('string', () => {
    it('aplica la expresión regular del registro', () => {
      const schema = buildValueSchema('string', { pattern: '^[a-z-]+$' });

      expect(schema.safeParse('modo-lento').success).toBe(true);
      expect(schema.safeParse('Modo Lento').success).toBe(false);
    });
  });

  describe('boolean', () => {
    it('no acepta cadenas que parezcan booleanos', () => {
      const schema = buildValueSchema('boolean');

      expect(schema.safeParse(true).success).toBe(true);
      expect(schema.safeParse('true').success).toBe(false);
    });
  });
});

/**
 * La razón de ser de las `constraints`: al mover la configuración a datos, los
 * límites dejaron de vivir en un esquema estático del backend. Si no viajaran
 * con el registro, el panel aceptaría cualquier número y la sincronización
 * intentaría descargar las páginas que le pidieran. Estos tests fijan que los
 * topes del catálogo real siguen mordiendo.
 */
describe('catálogo de siscout', () => {
  const entrada = (key: string) => {
    const encontrada = SISCOUT_CONFIG_GROUP.entries.find(
      (cada) => cada.key === key,
    );
    if (!encontrada)
      throw new Error(`falta la entrada "${key}" en el catálogo`);
    return encontrada;
  };

  const schemaDe = (key: string) => {
    const definicion = entrada(key);
    return buildValueSchema(definicion.type, definicion.constraints);
  };

  it('maxPages no admite un valor capaz de tumbar la sincronización', () => {
    expect(schemaDe('maxPages').safeParse(3).success).toBe(true);
    expect(schemaDe('maxPages').safeParse(999999).success).toBe(false);
  });

  it('pageLength se queda dentro de lo que aguanta SiScout', () => {
    expect(schemaDe('pageLength').safeParse(4000).success).toBe(true);
    expect(schemaDe('pageLength').safeParse(10001).success).toBe(false);
  });

  it('writeChunkSize no admite lotes de cero ni desmedidos', () => {
    expect(schemaDe('writeChunkSize').safeParse(500).success).toBe(true);
    expect(schemaDe('writeChunkSize').safeParse(0).success).toBe(false);
    expect(schemaDe('writeChunkSize').safeParse(5001).success).toBe(false);
  });

  it('zoneIds exige al menos una zona y la deduplica', () => {
    expect(schemaDe('zoneIds').safeParse([]).success).toBe(false);
    expect(schemaDe('zoneIds').parse([1, 1, 2])).toEqual([1, 2]);
  });

  it('syncCron rechaza una expresión inválida', () => {
    expect(schemaDe('syncCron').safeParse('0 3 * * *').success).toBe(true);
    expect(schemaDe('syncCron').safeParse('todos los días').success).toBe(
      false,
    );
  });

  it('cada entrada declara su valor por defecto dentro de sus propios límites', () => {
    for (const definicion of SISCOUT_CONFIG_GROUP.entries) {
      const schema = buildValueSchema(definicion.type, definicion.constraints);
      const resultado = schema.safeParse(definicion.value);

      expect({ key: definicion.key, ok: resultado.success }).toEqual({
        key: definicion.key,
        ok: true,
      });
    }
  });
});
