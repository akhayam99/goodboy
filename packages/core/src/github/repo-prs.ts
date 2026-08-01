import type { PullRequestState } from '@goodboy/types';
import type { GhRunner, GhRunOptions } from './gh';
import { GhCliError, runJson } from './gh';
import { PR_FIELDS, toPullRequestState, type RawPullRequest } from './resolver';

const REPO_PR_FIELDS = [...PR_FIELDS, 'author', 'reviewRequests'] as const;

type RawRepoPullRequest = RawPullRequest & {
  author: { login?: string | null } | null;
  reviewRequests: ReadonlyArray<{ login?: string | null }> | null;
};

export type RepoPullRequest = PullRequestState & {
  author: string;
  reviewRequestLogins: ReadonlyArray<string>;
};

export const listOpenPrsForRepo = async (
  runner: GhRunner,
  repo: string,
  opts: GhRunOptions = {},
): Promise<ReadonlyArray<RepoPullRequest>> => {
  const args = [
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'open',
    '--limit',
    '100',
    '--json',
    REPO_PR_FIELDS.join(','),
  ];
  let raw: ReadonlyArray<RawRepoPullRequest>;
  try {
    raw = await runJson<ReadonlyArray<RawRepoPullRequest>>(runner, args, opts);
  } catch (err) {
    if (err instanceof GhCliError) {
      return [];
    }
    throw err;
  }
  return [...raw]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((pr) => ({
      ...toPullRequestState(pr),
      author: pr.author?.login ?? '',
      reviewRequestLogins: (pr.reviewRequests ?? [])
        .map((r) => r.login ?? '')
        .filter((login) => login !== ''),
    }));
};
