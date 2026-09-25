export const m182RetainedWorktreeLedger = `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS retained_worktree_paths_new;

CREATE TABLE retained_worktree_paths_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  project_id TEXT,
  source_session_id TEXT,
  source_mount_id TEXT,
  repo_root TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  branch TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unmount', 'merge_cleanup', 'archive', 'session_delete', 'project_disconnect', 'settings', 'orphan')),
  last_checked_at INTEGER,
  first_seen_at INTEGER NOT NULL,
  size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
  sized_at INTEGER,
  kept_at INTEGER,
  kept_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((source_session_id IS NULL) = (source_mount_id IS NULL)),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

INSERT INTO retained_worktree_paths_new (
  id, workspace_id, project_id, source_session_id, source_mount_id, repo_root,
  worktree_path, branch, reason, last_checked_at, first_seen_at, created_at, updated_at
)
SELECT
  id, workspace_id, project_id, source_session_id, source_mount_id, repo_root,
  worktree_path, branch, reason, last_checked_at, created_at, created_at, updated_at
FROM retained_worktree_paths;

DROP TABLE retained_worktree_paths;
ALTER TABLE retained_worktree_paths_new RENAME TO retained_worktree_paths;

CREATE INDEX IF NOT EXISTS idx_retained_worktree_paths_workspace_id ON retained_worktree_paths(workspace_id);
CREATE INDEX IF NOT EXISTS idx_retained_worktree_paths_project_id ON retained_worktree_paths(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_retained_worktree_paths_path ON retained_worktree_paths(worktree_path);
CREATE INDEX IF NOT EXISTS idx_retained_worktree_paths_source
  ON retained_worktree_paths(source_session_id, source_mount_id);
CREATE INDEX IF NOT EXISTS idx_retained_worktree_paths_repo_root ON retained_worktree_paths(repo_root);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
