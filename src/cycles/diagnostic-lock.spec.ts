import { isDiagnosticLocked } from './diagnostic-lock';

describe('isDiagnosticLocked', () => {
  it('está abierto sin respuestas ni síntesis', () => {
    expect(isDiagnosticLocked({ diagnosticAnswers: [] })).toBe(false);
  });

  it('está abierto con respuestas pero sin síntesis', () => {
    expect(isDiagnosticLocked({ diagnosticAnswers: [{}] })).toBe(false);
  });

  it('está abierto con una síntesis que solo tiene espacios', () => {
    expect(
      isDiagnosticLocked({ diagnosticAnswers: [{}], diagnosticSummary: '   ' }),
    ).toBe(false);
  });

  it('está abierto con síntesis pero sin respuestas', () => {
    expect(
      isDiagnosticLocked({ diagnosticAnswers: [], diagnosticSummary: 'Algo' }),
    ).toBe(false);
  });

  it('está cerrado con respuestas y síntesis', () => {
    expect(
      isDiagnosticLocked({
        diagnosticAnswers: [{}],
        diagnosticSummary: 'Algo',
      }),
    ).toBe(true);
  });
});
