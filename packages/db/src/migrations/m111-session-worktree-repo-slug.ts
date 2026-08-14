export const m111SessionWorktreeRepoSlug = /* sql */ `
ALTER TABLE session_worktrees ADD COLUMN repo_slug TEXT;

CREATE INDEX idx_session_worktrees_repo_slug_branch
  ON session_worktrees(repo_slug, branch);
`;
