import { type Branch, type DiagnosticBlock } from '../domain';

export interface AnswerInput {
  questionId: string;
  score: number;
  notes?: string;
}

export interface QuestionRef {
  id: string;
  branch: Branch;
  block: DiagnosticBlock;
  text: string;
}

export interface BuiltAnswer {
  questionId: string;
  questionText: string;
  block: DiagnosticBlock;
  score: number;
  notes?: string;
}

export type DiagnosticProblem =
  'duplicate' | 'unknown-question' | 'branch-mismatch';

export function findDiagnosticProblem(
  answers: AnswerInput[],
  questions: QuestionRef[],
  unitBranch: Branch,
): DiagnosticProblem | null {
  const seen = new Set<string>();
  const byId = new Map(questions.map((q) => [q.id, q]));

  for (const answer of answers) {
    if (seen.has(answer.questionId)) return 'duplicate';
    seen.add(answer.questionId);

    const question = byId.get(answer.questionId);
    if (!question) return 'unknown-question';
    if (question.branch !== unitBranch) return 'branch-mismatch';
  }

  return null;
}

// Precondición: findDiagnosticProblem(answers, questions, branch) debe devolver null
// antes de llamar este. El cast es seguro porque findDiagnosticProblem ya validó
// que cada questionId existe en el catálogo y pertenece a la rama correcta.
export function buildAnswers(
  answers: AnswerInput[],
  questions: QuestionRef[],
): BuiltAnswer[] {
  const byId = new Map(questions.map((q) => [q.id, q]));

  return answers.map((answer) => {
    const question = byId.get(answer.questionId) as QuestionRef;
    return {
      questionId: answer.questionId,
      questionText: question.text,
      block: question.block,
      score: answer.score,
      ...(answer.notes === undefined ? {} : { notes: answer.notes }),
    };
  });
}
