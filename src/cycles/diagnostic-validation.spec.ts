import { D } from '../domain';
import { buildAnswers, findDiagnosticProblem } from './diagnostic-validation';

const QUESTIONS = [
  {
    id: 'q1',
    branch: D.BRANCH.MANADA,
    block: D.DIAGNOSTIC_BLOCK.RAP,
    text: 'Uno',
  },
  {
    id: 'q2',
    branch: D.BRANCH.MANADA,
    block: D.DIAGNOSTIC_BLOCK.GSAT,
    text: 'Dos',
  },
];

describe('findDiagnosticProblem', () => {
  it('no encuentra problema en un envío correcto', () => {
    const answers = [
      { questionId: 'q1', score: 4 },
      { questionId: 'q2', score: 2, notes: 'Flojo' },
    ];

    expect(
      findDiagnosticProblem(answers, QUESTIONS, D.BRANCH.MANADA),
    ).toBeNull();
  });

  it('detecta preguntas repetidas', () => {
    const answers = [
      { questionId: 'q1', score: 4 },
      { questionId: 'q1', score: 5 },
    ];

    expect(findDiagnosticProblem(answers, QUESTIONS, D.BRANCH.MANADA)).toBe(
      'duplicate',
    );
  });

  it('detecta una pregunta que no está en el catálogo activo', () => {
    const answers = [{ questionId: 'q9', score: 3 }];

    expect(findDiagnosticProblem(answers, QUESTIONS, D.BRANCH.MANADA)).toBe(
      'unknown-question',
    );
  });

  it('detecta una pregunta de otra rama', () => {
    const answers = [{ questionId: 'q1', score: 3 }];

    expect(findDiagnosticProblem(answers, QUESTIONS, D.BRANCH.TROPA)).toBe(
      'branch-mismatch',
    );
  });

  it('un duplicado en otra rama devuelve branch-mismatch (se detecta primero en la iteración)', () => {
    const answers = [
      { questionId: 'q1', score: 4 },
      { questionId: 'q1', score: 5 },
    ];

    expect(findDiagnosticProblem(answers, QUESTIONS, D.BRANCH.TROPA)).toBe(
      'branch-mismatch',
    );
  });

  it('problemas distintos en el mismo array: gana el primero en orden', () => {
    const answers = [
      { questionId: 'q9', score: 3 },
      { questionId: 'q1', score: 4 },
    ];

    expect(findDiagnosticProblem(answers, QUESTIONS, D.BRANCH.TROPA)).toBe(
      'unknown-question',
    );
  });

  it('detecta que falta responder alguna pregunta del catálogo', () => {
    const answers = [{ questionId: 'q1', score: 4 }];

    expect(findDiagnosticProblem(answers, QUESTIONS, D.BRANCH.MANADA)).toBe(
      'incomplete',
    );
  });

  it('detecta un envío vacío como incompleto', () => {
    expect(findDiagnosticProblem([], QUESTIONS, D.BRANCH.MANADA)).toBe(
      'incomplete',
    );
  });

  it('trata un catálogo sin preguntas como incompleto', () => {
    expect(findDiagnosticProblem([], [], D.BRANCH.MANADA)).toBe('incomplete');
  });
});

describe('buildAnswers', () => {
  it('copia el texto y el bloque desde el catálogo', () => {
    const answers = [{ questionId: 'q2', score: 5, notes: 'Bien' }];

    expect(buildAnswers(answers, QUESTIONS)).toEqual([
      {
        questionId: 'q2',
        questionText: 'Dos',
        block: D.DIAGNOSTIC_BLOCK.GSAT,
        score: 5,
        notes: 'Bien',
      },
    ]);
  });

  it('ignora lo que el cliente mande como texto o bloque', () => {
    const answers = [
      {
        questionId: 'q1',
        score: 1,
        questionText: 'Falso',
        block: D.DIAGNOSTIC_BLOCK.DURASLID,
      },
    ] as unknown as { questionId: string; score: number }[];

    expect(buildAnswers(answers, QUESTIONS)[0]).toMatchObject({
      questionText: 'Uno',
      block: D.DIAGNOSTIC_BLOCK.RAP,
    });
  });
});
