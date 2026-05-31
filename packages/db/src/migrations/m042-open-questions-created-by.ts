export const m042OpenQuestionsCreatedBy = /* sql */ `
-- Per-agent provenance: which agent emitted the question. Lets the UI
-- cluster open questions by their owner agent and route batched answers
-- back to that specific agent's chat instead of the currently-selected
-- one. Nullable so legacy rows (created before this column existed) and
-- ad-hoc inserts without an agent context remain valid.
-- ON DELETE SET NULL: hard-deleting an agent (rare - user-driven) should
-- not refuse because of pending questions. The question simply becomes an
-- orphan (clusters fall back to the "ungrouped" bucket).
ALTER TABLE open_questions ADD COLUMN created_by_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL;
CREATE INDEX idx_open_questions_created_by_agent ON open_questions(created_by_agent_id);
`;
