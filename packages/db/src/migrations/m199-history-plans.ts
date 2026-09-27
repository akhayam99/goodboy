export const m199HistoryPlans = `
CREATE TABLE IF NOT EXISTS history_plans (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  mount_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  head_sha TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'applied', 'pushed', 'discarded')),
  backup_ref TEXT NULL,
  remote_sha_at_apply TEXT NULL,
  applied_at INTEGER NULL,
  pushed_at INTEGER NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_history_plans_one_draft ON history_plans (mount_id) WHERE state = 'draft';
CREATE INDEX IF NOT EXISTS idx_history_plans_session ON history_plans (session_id);
CREATE INDEX IF NOT EXISTS idx_history_plans_branch ON history_plans (mount_id, branch, state);
`;
