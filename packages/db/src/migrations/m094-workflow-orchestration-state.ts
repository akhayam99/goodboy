export const m094WorkflowOrchestrationState = /* sql */ `
ALTER TABLE session_workflows ADD COLUMN orchestration_error TEXT;
ALTER TABLE session_workflows ADD COLUMN orchestrator_hints TEXT;
`;
