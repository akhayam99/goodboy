export const m154ResolveMountBackfill = `
UPDATE resolve_candidates
SET mount_id = (
      SELECT w.id FROM session_worktrees w
      WHERE w.session_id = resolve_candidates.session_id
        AND w.worktree_path = resolve_candidates.worktree_path
    ),
    mount_revision = (
      SELECT w.revision FROM session_worktrees w
      WHERE w.session_id = resolve_candidates.session_id
        AND w.worktree_path = resolve_candidates.worktree_path
    )
WHERE mount_id IS NULL
  AND (
    SELECT COUNT(*) FROM session_worktrees w
    WHERE w.session_id = resolve_candidates.session_id
      AND w.worktree_path = resolve_candidates.worktree_path
  ) = 1;

UPDATE resolve_candidates
SET mount_id = (
      SELECT w.id FROM session_worktrees w
      WHERE w.session_id = resolve_candidates.session_id
        AND w.last_worktree_path = resolve_candidates.worktree_path
    ),
    mount_revision = (
      SELECT w.revision FROM session_worktrees w
      WHERE w.session_id = resolve_candidates.session_id
        AND w.last_worktree_path = resolve_candidates.worktree_path
    )
WHERE mount_id IS NULL
  AND (
    SELECT COUNT(*) FROM session_worktrees w
    WHERE w.session_id = resolve_candidates.session_id
      AND w.last_worktree_path = resolve_candidates.worktree_path
  ) = 1;

UPDATE resolve_attempts
SET mount_id = (SELECT c.mount_id FROM resolve_candidates c WHERE c.id = resolve_attempts.id),
    mount_revision = (
      SELECT c.mount_revision FROM resolve_candidates c WHERE c.id = resolve_attempts.id
    ),
    worktree_path = (
      SELECT c.worktree_path FROM resolve_candidates c WHERE c.id = resolve_attempts.id
    )
WHERE mount_id IS NULL
  AND EXISTS (
    SELECT 1 FROM resolve_candidates c
    WHERE c.id = resolve_attempts.id AND c.mount_id IS NOT NULL
  );

UPDATE resolve_attempts
SET mount_id = (
      SELECT w.id FROM session_worktrees w
      WHERE w.session_id = resolve_attempts.session_id
        AND w.is_attached = 1
        AND w.project_id IS NOT NULL
        AND w.worktree_path IS NOT NULL
        AND w.disk_state NOT IN ('missing', 'removed')
    ),
    mount_revision = (
      SELECT w.revision FROM session_worktrees w
      WHERE w.session_id = resolve_attempts.session_id
        AND w.is_attached = 1
        AND w.project_id IS NOT NULL
        AND w.worktree_path IS NOT NULL
        AND w.disk_state NOT IN ('missing', 'removed')
    ),
    worktree_path = (
      SELECT w.worktree_path FROM session_worktrees w
      WHERE w.session_id = resolve_attempts.session_id
        AND w.is_attached = 1
        AND w.project_id IS NOT NULL
        AND w.worktree_path IS NOT NULL
        AND w.disk_state NOT IN ('missing', 'removed')
    )
WHERE mount_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM resolve_candidates c WHERE c.id = resolve_attempts.id)
  AND (
    SELECT COUNT(*) FROM session_worktrees w
    WHERE w.session_id = resolve_attempts.session_id
      AND w.is_attached = 1
      AND w.project_id IS NOT NULL
      AND w.worktree_path IS NOT NULL
      AND w.disk_state NOT IN ('missing', 'removed')
  ) = 1;

UPDATE resolve_publications
SET mount_id = (
      SELECT MIN(c.mount_id) FROM resolve_candidates c
      WHERE c.id IN (SELECT value FROM json_each(resolve_publications.candidate_ids_json))
    ),
    mount_revision = (
      SELECT w.revision FROM session_worktrees w
      WHERE w.id = (
        SELECT MIN(c.mount_id) FROM resolve_candidates c
        WHERE c.id IN (SELECT value FROM json_each(resolve_publications.candidate_ids_json))
      )
    ),
    worktree_path = (
      SELECT w.worktree_path FROM session_worktrees w
      WHERE w.id = (
        SELECT MIN(c.mount_id) FROM resolve_candidates c
        WHERE c.id IN (SELECT value FROM json_each(resolve_publications.candidate_ids_json))
      )
    )
WHERE mount_id IS NULL
  AND json_valid(candidate_ids_json)
  AND json_array_length(candidate_ids_json) > 0
  AND (
    SELECT COUNT(*) FROM resolve_candidates c
    WHERE c.id IN (SELECT value FROM json_each(resolve_publications.candidate_ids_json))
  ) = json_array_length(candidate_ids_json)
  AND (
    SELECT COUNT(DISTINCT c.mount_id) FROM resolve_candidates c
    WHERE c.id IN (SELECT value FROM json_each(resolve_publications.candidate_ids_json))
      AND c.mount_id IS NOT NULL
  ) = 1
  AND NOT EXISTS (
    SELECT 1 FROM resolve_candidates c
    WHERE c.id IN (SELECT value FROM json_each(resolve_publications.candidate_ids_json))
      AND c.mount_id IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM session_worktrees w
    WHERE w.id = (
        SELECT MIN(c.mount_id) FROM resolve_candidates c
        WHERE c.id IN (SELECT value FROM json_each(resolve_publications.candidate_ids_json))
      )
      AND w.worktree_path IS NOT NULL
  );

UPDATE resolve_publications
SET mount_id = (
      SELECT w.id FROM session_worktrees w
      WHERE w.session_id = resolve_publications.session_id
        AND w.branch = resolve_publications.branch
        AND w.worktree_path IS NOT NULL
    ),
    mount_revision = (
      SELECT w.revision FROM session_worktrees w
      WHERE w.session_id = resolve_publications.session_id
        AND w.branch = resolve_publications.branch
        AND w.worktree_path IS NOT NULL
    ),
    worktree_path = (
      SELECT w.worktree_path FROM session_worktrees w
      WHERE w.session_id = resolve_publications.session_id
        AND w.branch = resolve_publications.branch
        AND w.worktree_path IS NOT NULL
    )
WHERE mount_id IS NULL
  AND (
    SELECT COUNT(*) FROM session_worktrees w
    WHERE w.session_id = resolve_publications.session_id
      AND w.branch = resolve_publications.branch
      AND w.worktree_path IS NOT NULL
  ) = 1
  AND NOT EXISTS (
    SELECT 1 FROM resolve_candidates c
    WHERE c.id IN (
        SELECT value FROM json_each(
          CASE WHEN json_valid(resolve_publications.candidate_ids_json)
            THEN resolve_publications.candidate_ids_json ELSE '[]' END
        )
      )
      AND c.worktree_path != (
        SELECT w.worktree_path FROM session_worktrees w
        WHERE w.session_id = resolve_publications.session_id
          AND w.branch = resolve_publications.branch
          AND w.worktree_path IS NOT NULL
      )
  );

UPDATE resolve_candidates
SET state = 'stale'
WHERE mount_id IS NULL AND state IN ('building', 'ready');

UPDATE resolve_publications
SET phase = 'failed', error = 'target_unresolved', completed_at = COALESCE(completed_at, created_at)
WHERE mount_id IS NULL
  AND phase IN ('previewed', 'confirmed', 'pushing', 'pushed', 'posting');
`;
