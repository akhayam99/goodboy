export const m198MergedBranchCleanup = `
ALTER TABLE workspaces ADD COLUMN after_merge TEXT
  CHECK (after_merge IS NULL OR after_merge IN ('ask', 'local', 'local-and-origin'));
UPDATE workspaces SET after_merge = 'ask';
ALTER TABLE projects ADD COLUMN after_merge TEXT
  CHECK (after_merge IS NULL OR after_merge IN ('ask', 'local', 'local-and-origin'));
ALTER TABLE session_worktrees ADD COLUMN branch_origin TEXT NOT NULL DEFAULT 'unknown'
  CHECK (branch_origin IN ('created', 'adopted', 'unknown'));
CREATE TABLE deleted_branches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT,
  repo_root TEXT NOT NULL,
  branch TEXT NOT NULL,
  sha TEXT NOT NULL,
  keep_ref TEXT NOT NULL,
  on_origin INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER NOT NULL,
  restored_at INTEGER
);
CREATE INDEX idx_deleted_branches_project ON deleted_branches(project_id, deleted_at);
`;
