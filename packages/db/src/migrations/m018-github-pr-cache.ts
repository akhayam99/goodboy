export const m018GithubPrCache = /* sql */ `
CREATE TABLE github_pr_cache (
  branch TEXT NOT NULL,
  repo_slug TEXT NOT NULL,
  pr_json TEXT,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (repo_slug, branch)
);

CREATE INDEX idx_github_pr_cache_branch ON github_pr_cache(branch);
`;
