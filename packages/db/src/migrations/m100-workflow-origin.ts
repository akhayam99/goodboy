export const m100WorkflowOrigin = `
ALTER TABLE workflows ADD COLUMN origin TEXT;

UPDATE workflows SET origin = 'library' WHERE id LIKE 'wf_seed_%';

UPDATE workflows SET origin = 'orchestrated'
WHERE origin IS NULL
  AND id IN (SELECT workflow_id FROM session_workflows WHERE execution_mode = 'dynamic');

UPDATE workflows SET origin = 'custom' WHERE origin IS NULL;
`;
