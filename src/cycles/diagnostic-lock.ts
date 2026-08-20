export function isDiagnosticLocked(cycle: {
  diagnosticAnswers: unknown[];
  diagnosticSummary?: string | null;
}): boolean {
  return (
    cycle.diagnosticAnswers.length > 0 &&
    Boolean(cycle.diagnosticSummary?.trim())
  );
}
