export const m076AgentSourceKind = /* sql */ `
ALTER TABLE agents ADD COLUMN source_kind TEXT;

UPDATE agents
SET source_kind = CASE
  WHEN source_thread_id IS NOT NULL THEN 'review_comment'
  WHEN source_comment_url IS NOT NULL THEN 'issue_comment'
  ELSE source_kind
END
WHERE source_thread_id IS NOT NULL OR source_comment_url IS NOT NULL;
`;
