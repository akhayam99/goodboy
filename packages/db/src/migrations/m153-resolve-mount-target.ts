export const m153ResolveMountTarget = `
ALTER TABLE resolve_attempts ADD COLUMN mount_id TEXT;
ALTER TABLE resolve_attempts ADD COLUMN mount_revision INTEGER;
ALTER TABLE resolve_attempts ADD COLUMN worktree_path TEXT;

ALTER TABLE resolve_candidates ADD COLUMN mount_id TEXT;
ALTER TABLE resolve_candidates ADD COLUMN mount_revision INTEGER;

ALTER TABLE resolve_publications ADD COLUMN mount_id TEXT;
ALTER TABLE resolve_publications ADD COLUMN mount_revision INTEGER;
ALTER TABLE resolve_publications ADD COLUMN worktree_path TEXT;

CREATE INDEX IF NOT EXISTS idx_resolve_attempts_mount ON resolve_attempts(mount_id);
CREATE INDEX IF NOT EXISTS idx_resolve_candidates_mount ON resolve_candidates(mount_id);
CREATE INDEX IF NOT EXISTS idx_resolve_publications_mount ON resolve_publications(mount_id);
`;
