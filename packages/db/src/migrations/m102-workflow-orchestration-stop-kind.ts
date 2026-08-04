export const m102WorkflowOrchestrationStopKind = /* sql */ `
ALTER TABLE session_workflows ADD COLUMN orchestration_stop_kind TEXT NOT NULL DEFAULT 'failure';

UPDATE session_workflows SET orchestration_stop_kind = 'budget'
WHERE orchestration_error = 'the budget cap is reached, raise it in Budget to keep this run going';
`;
