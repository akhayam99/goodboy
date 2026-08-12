export const m109WorkflowRunSummary = /* sql */ `
ALTER TABLE session_workflows ADD COLUMN orchestrator_summary TEXT;
`;
