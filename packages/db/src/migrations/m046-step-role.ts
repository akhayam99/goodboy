/**
 * m046 - per-instance step role.
 *
 * The in-workflow step instance (`steps`) had no explicit role: the UI inferred
 * it from the step name, so users couldn't override "what kind of agent is
 * this". This adds a nullable `role` column (an AgentRole string). NULL = fall
 * back to the library step's role, then to name inference.
 */
export const m046StepRole = /* sql */ `
ALTER TABLE steps ADD COLUMN role TEXT;
`;
