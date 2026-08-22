import type { CachedPullRequest, GithubPrCacheEntry } from '@goodboy/types';
import type { Database } from '../client';

type Row = {
  branch: string;
  repo_slug: string;
  pr_json: string | null;
  fetched_at: string;
};

const CACHE_TTL_MS = 10 * 60 * 1000;

function toDomain(row: Row): GithubPrCacheEntry {
  return {
    branch: row.branch,
    repoSlug: row.repo_slug,
    pr:
      row.pr_json != null && row.pr_json.length > 0
        ? (JSON.parse(row.pr_json) as CachedPullRequest)
        : null,
    fetchedAt: row.fetched_at,
  };
}

export const getGithubPrCache = async (
  db: Database,
  repoSlug: string,
  branch: string,
): Promise<GithubPrCacheEntry | null> => {
  const rows = await db.select<Row>(
    'SELECT branch, repo_slug, pr_json, fetched_at FROM github_pr_cache WHERE repo_slug = ? AND branch = ? LIMIT 1',
    [repoSlug, branch],
  );
  const first = rows[0];
  if (first === undefined) {
    return null;
  }
  const fetchedAt = Date.parse(first.fetched_at);
  if (Number.isNaN(fetchedAt) || Date.now() - fetchedAt > CACHE_TTL_MS) {
    return null;
  }
  return toDomain(first);
};

export const upsertGithubPrCache = async (
  db: Database,
  entry: GithubPrCacheEntry,
): Promise<void> => {
  await db.execute(
    `INSERT INTO github_pr_cache (branch, repo_slug, pr_json, fetched_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(repo_slug, branch) DO UPDATE SET
       pr_json = excluded.pr_json,
       fetched_at = excluded.fetched_at`,
    [entry.branch, entry.repoSlug, entry.pr ? JSON.stringify(entry.pr) : null, entry.fetchedAt],
  );
};

export const deleteGithubPrCache = async (
  db: Database,
  repoSlug: string,
  branch: string,
): Promise<void> => {
  await db.execute('DELETE FROM github_pr_cache WHERE repo_slug = ? AND branch = ?', [
    repoSlug,
    branch,
  ]);
};

type DeleteForWorktreePathParams = {
  readonly db: Database;
  readonly worktreePath: string;
};

export const deleteGithubPrCacheForWorktreePath = async ({
  db,
  worktreePath,
}: DeleteForWorktreePathParams): Promise<number> => {
  const result = await db.execute(
    `DELETE FROM github_pr_cache
     WHERE EXISTS (
       SELECT 1
       FROM session_worktrees sw
       WHERE sw.worktree_path = ?
         AND sw.branch = github_pr_cache.branch
         AND (sw.repo_slug IS NULL OR sw.repo_slug = github_pr_cache.repo_slug)
     )`,
    [worktreePath],
  );
  return result.rowsAffected;
};
