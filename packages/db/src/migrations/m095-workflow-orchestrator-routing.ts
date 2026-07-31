export const m095WorkflowOrchestratorRouting = /* sql */ `
ALTER TABLE session_workflows ADD COLUMN orchestration_reason TEXT;
ALTER TABLE session_workflows ADD COLUMN orchestrator_provider TEXT;
ALTER TABLE session_workflows ADD COLUMN orchestrator_model TEXT;
ALTER TABLE session_workflows ADD COLUMN orchestrator_effort TEXT;
`;
