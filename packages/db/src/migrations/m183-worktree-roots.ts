export const m183WorktreeRoots = `
CREATE TABLE IF NOT EXISTS worktree_roots (
  repo_root TEXT PRIMARY KEY,
  first_seen_at INTEGER NOT NULL,
  last_scanned_at INTEGER,
  added_by TEXT NOT NULL CHECK (added_by IN ('project', 'mount', 'user'))
);

INSERT OR IGNORE INTO worktree_roots (repo_root, first_seen_at, added_by)
SELECT root_path, MIN(created_at), 'project'
FROM projects
WHERE kind = 'repo' AND root_path != ''
GROUP BY root_path;

INSERT OR IGNORE INTO worktree_roots (repo_root, first_seen_at, added_by)
SELECT repo_root, MIN(created_at), 'mount'
FROM retained_worktree_paths
WHERE repo_root != ''
GROUP BY repo_root;

INSERT OR IGNORE INTO worktree_roots (repo_root, first_seen_at, added_by)
SELECT substr(path, 1, instr(path, '/.goodboy/worktrees/') - 1), MIN(created_at), 'mount'
FROM (
  SELECT worktree_path AS path, created_at FROM session_worktrees WHERE worktree_path IS NOT NULL
  UNION ALL
  SELECT last_worktree_path AS path, created_at FROM session_worktrees WHERE last_worktree_path IS NOT NULL
)
WHERE instr(path, '/.goodboy/worktrees/') > 1
GROUP BY substr(path, 1, instr(path, '/.goodboy/worktrees/') - 1);
`;
