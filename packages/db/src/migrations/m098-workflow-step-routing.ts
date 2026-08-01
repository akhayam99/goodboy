export const m098WorkflowStepRouting = `
ALTER TABLE session_workflows ADD COLUMN step_provider TEXT;
ALTER TABLE session_workflows ADD COLUMN step_model TEXT;
ALTER TABLE session_workflows ADD COLUMN step_effort TEXT;
`;
