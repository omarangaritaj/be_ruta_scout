import { buildAnswers, findDiagnosticProblem } from './diagnostic-validation';

const QUESTIONS = [
  { id: 'q1', branch: 'manada' as const, block: 'rap' as const, text: 'Uno' },
  { id: 'q2', branch: 'manada' as const, block: 'gsat' as const, text: 'Dos' },
];

describe('findDiagnosticProblem', () => {
  it('no encuentra problema en un envío correcto', () => {
    const answers = [
      { questionId: 'q1', score: 4 },
      { questionId: 'q2', score: 2, notes: 'Flojo' },
    ];

    expect(findDiagnosticProblem(answers, QUESTIONS, 'manada')).toBeNull();
  });

  it('detecta preguntas repetidas', () => {
    const answers = [
      { questionId: 'q1', score: 4 },
      { questionId: 'q1', score: 5 },
    ];

    expect(findDiagnosticProblem(answers, QUESTIONS, 'manada')).toBe(
      'duplicate',
    );
  });

  it('detecta una pregunta que no está en el catálogo activo', () => {
    const answers = [{ questionId: 'q9', score: 3 }];

    expect(findDiagnosticProblem(answers, QUESTIONS, 'manada')).toBe(
      'unknown-question',
    );
  });

  it('detecta una pregunta de otra rama', () => {
    const answers = [{ questionId: 'q1', score: 3 }];

    expect(findDiagnosticProblem(answers, QUESTIONS, 'tropa')).toBe(
      'branch-mismatch',
    );
  });

  it('acepta un envío vacío', () => {
    expect(findDiagnosticProblem([], QUESTIONS, 'manada')).toBeNull();
  });

  it('un duplicado en otra rama devuelve branch-mismatch (se detecta primero en la iteración)', () => {
    const answers = [
      { questionId: 'q1', score: 4 },
      { questionId: 'q1', score: 5 },
    ];

    expect(findDiagnosticProblem(answers, QUESTIONS, 'tropa')).toBe(
      'branch-mismatch',
    );
  });

  it('problemas distintos en el mismo array: gana el primero en orden', () => {
    const answers = [
      { questionId: 'q9', score: 3 }, // desconocida
      { questionId: 'q1', score: 4 }, // branch-mismatch
    ];

    expect(findDiagnosticProblem(answers, QUESTIONS, 'tropa')).toBe(
      'unknown-question',
    );
  });
});

describe('buildAnswers', () => {
  it('copia el texto y el bloque desde el catálogo', () => {
    const answers = [{ questionId: 'q2', score: 5, notes: 'Bien' }];

    expect(buildAnswers(answers, QUESTIONS)).toEqual([
      {
        questionId: 'q2',
        questionText: 'Dos',
        block: 'gsat',
        score: 5,
        notes: 'Bien',
      },
    ]);
  });

  it('ignora lo que el cliente mande como texto o bloque', () => {
    const answers = [
      { questionId: 'q1', score: 1, questionText: 'Falso', block: 'duraslid' },
    ] as unknown as { questionId: string; score: number }[];

    expect(buildAnswers(answers, QUESTIONS)[0]).toMatchObject({
      questionText: 'Uno',
      block: 'rap',
    });
  });
});
