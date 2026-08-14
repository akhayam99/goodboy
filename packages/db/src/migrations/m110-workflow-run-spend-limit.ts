export const m110WorkflowRunSpendLimit = /* sql */ `
ALTER TABLE session_workflows ADD COLUMN spend_limit_usd REAL;
ALTER TABLE session_workflows ADD COLUMN spend_limit_mode TEXT NOT NULL DEFAULT 'pause';
`;
