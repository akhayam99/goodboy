export const m225ResolveAttemptFailureCause = `
ALTER TABLE resolve_attempts ADD COLUMN failure_cause TEXT;
`;
