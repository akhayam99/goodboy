export const m056CompositeWorkspaces = /* sql */ `
ALTER TABLE workspaces ADD COLUMN kind TEXT NOT NULL DEFAULT 'repo';
CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  composite_workspace_id TEXT NOT NULL,
  member_workspace_id TEXT NOT NULL,
  mount_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (composite_workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (member_workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_workspace_members_composite ON workspace_members(composite_workspace_id);
ALTER TABLE session_worktrees ADD COLUMN mount_workspace_id TEXT;
ALTER TABLE session_worktrees ADD COLUMN mount_name TEXT;
`
