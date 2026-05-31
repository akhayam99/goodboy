export const m049SessionWorkflowDiscard = /* sql */ `
ALTER TABLE session_workflows ADD COLUMN discarded_at TEXT;
`;
