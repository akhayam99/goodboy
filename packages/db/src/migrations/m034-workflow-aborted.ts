export const m034WorkflowAborted = /* sql */ `
ALTER TABLE sessions ADD COLUMN workflow_aborted INTEGER NOT NULL DEFAULT 0
  CHECK (workflow_aborted IN (0, 1));
`;
