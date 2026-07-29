export function isDiagnosticLocked(cycle: {
  diagnosticAnswers: unknown[];
  diagnosticSummary?: string;
}): boolean {
  return (
    cycle.diagnosticAnswers.length > 0 &&
    Boolean(cycle.diagnosticSummary?.trim())
  );
}
