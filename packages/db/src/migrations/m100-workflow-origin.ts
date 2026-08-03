export const m100WorkflowOrigin = `
ALTER TABLE workflows ADD COLUMN origin TEXT;

UPDATE workflows SET origin = 'library' WHERE id LIKE 'wf_seed_%';

UPDATE workflows SET origin = 'orchestrated'
WHERE origin IS NULL
  AND (
    id IN (SELECT workflow_id FROM session_workflows WHERE execution_mode = 'dynamic')
    OR id IN (SELECT workflow_id FROM steps WHERE orchestrator_reason IS NOT NULL)
    OR name = 'Orchestrated workflow'
    OR name GLOB 'Orchestrated workflow [0-9]*'
  );

UPDATE workflows SET origin = 'custom' WHERE origin IS NULL;
`;
