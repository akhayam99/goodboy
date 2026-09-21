export const m162OpenQuestionBlockingAndProvenance = `
ALTER TABLE open_questions ADD COLUMN is_blocking INTEGER NOT NULL DEFAULT 0
  CHECK (is_blocking IN (0, 1));
ALTER TABLE open_questions ADD COLUMN answer_source TEXT
  CHECK (answer_source IS NULL OR answer_source IN ('user', 'agent'));
ALTER TABLE open_questions ADD COLUMN answered_by_agent_id TEXT
  REFERENCES agents(id) ON DELETE SET NULL;
UPDATE open_questions SET answer_source = 'user' WHERE status = 'answered';
`;
