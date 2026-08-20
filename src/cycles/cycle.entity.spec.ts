import { Cycle, type CycleCompetency, type CycleFocus } from './cycle.entity';
import { D } from '../domain';

/**
 * El frontend recorre `focus.competencies` y `diagnosticAnswers` sin comprobar
 * si existen, porque el sistema anterior los declaraba con `default: []` y
 * Mongoose los materializaba en cada respuesta. Al pasar a jsonb hay filas que
 * se guardaron como `{}`: la entidad debe reponer la forma al leerlas.
 */
describe('Cycle.normalizarFocus', () => {
  function cicloCon(focus: unknown, answers?: unknown): Cycle {
    const cycle = new Cycle();
    cycle.focus = focus as CycleFocus;
    cycle.diagnosticAnswers = answers as Cycle['diagnosticAnswers'];
    return cycle;
  }

  it('repone competencies cuando el jsonb se guardó vacío', () => {
    const cycle = cicloCon({});

    cycle.normalizarFocus();

    expect(cycle.focus.competencies).toEqual([]);
  });

  it('conserva las competencias ya elegidas', () => {
    const competencia: CycleCompetency = {
      growthItemId: 'aa9f4d1c-6f5c-4c0a-9c62-8f2f1d0b7e11',
      text: 'Cuida su cuerpo',
      growthArea: D.GROWTH_AREA.CORPORALIDAD,
    };
    const cycle = cicloCon({
      objective: 'Convivir',
      competencies: [competencia],
    });

    cycle.normalizarFocus();

    expect(cycle.focus.competencies).toEqual([competencia]);
    expect(cycle.focus.objective).toBe('Convivir');
  });

  it('repone diagnosticAnswers ausente', () => {
    const cycle = cicloCon({}, undefined);

    cycle.normalizarFocus();

    expect(cycle.diagnosticAnswers).toEqual([]);
  });

  it('no pisa las respuestas del diagnóstico ya guardadas', () => {
    const respuesta = {
      questionId: 'e1f0c2d3-1111-4a2b-9c3d-4e5f60718293',
      questionText: '¿La unidad practica el sistema de patrullas?',
      block: D.DIAGNOSTIC_BLOCK.RAP,
      score: 4,
    };
    const cycle = cicloCon({}, [respuesta]);

    cycle.normalizarFocus();

    expect(cycle.diagnosticAnswers).toEqual([respuesta]);
  });
});
