export const m060WorkflowTriggerMode = /* sql */ `
ALTER TABLE session_workflows ADD COLUMN trigger_mode TEXT NOT NULL DEFAULT 'immediate';
ALTER TABLE session_workflows ADD COLUMN chain_after_run_id TEXT;
`
