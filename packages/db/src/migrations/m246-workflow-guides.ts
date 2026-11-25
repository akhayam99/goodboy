export const m246WorkflowGuides = `
ALTER TABLE workflows ADD COLUMN entry_check TEXT;

ALTER TABLE workflows ADD COLUMN stop_rule TEXT;

ALTER TABLE workflows ADD COLUMN then_suggest_id TEXT;

ALTER TABLE workflows ADD COLUMN is_order_kept INTEGER NOT NULL DEFAULT 0 CHECK (is_order_kept IN (0, 1));

ALTER TABLE auto_trees ADD COLUMN guide TEXT CHECK (guide IS NULL OR json_valid(guide));

CREATE TABLE agent_turn_picks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE REFERENCES agent_turn_spans(run_id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('lead', 'fallback', 'pinned', 'best')),
  adjustment TEXT,
  requested_model TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
