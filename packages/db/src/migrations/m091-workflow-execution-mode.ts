export const m091WorkflowExecutionMode = /* sql */ `
ALTER TABLE session_workflows ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'static';
`;
