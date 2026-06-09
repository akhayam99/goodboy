import type { GithubPrCacheEntry, PullRequestState } from '@goodboy/types';
import type { Database } from '../client';

type Row = {
  branch: string;
  repo_slug: string;
  pr_json: string | null;
  fetched_at: string;
};

function toDomain(row: Row): GithubPrCacheEntry {
  return {
    branch: row.branch,
    repoSlug: row.repo_slug,
    pr: row.pr_json ? (JSON.parse(row.pr_json) as PullRequestState) : null,
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
  return first ? toDomain(first) : null;
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
