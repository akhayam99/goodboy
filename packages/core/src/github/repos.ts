import type { GhRunner, GhRunOptions } from './gh';
import { GhCliError, runJson } from './gh';

export type GithubRepoRef = {
  readonly nameWithOwner: string;
  readonly url: string;
  readonly sshUrl: string;
  readonly isPrivate: boolean;
};

export type OwnedReposResult =
  | { readonly kind: 'ok'; readonly repos: ReadonlyArray<GithubRepoRef> }
  | { readonly kind: 'unauthenticated' }
  | { readonly kind: 'failed'; readonly message: string };

const REPO_FIELDS = ['nameWithOwner', 'url', 'sshUrl', 'isPrivate'] as const;

const UNAUTHENTICATED_PATTERN = /auth login|not logged in|authentication|credentials/i;

export const listOwnedRepos = async (
  runner: GhRunner,
  opts: GhRunOptions = {},
): Promise<OwnedReposResult> => {
  const args = ['repo', 'list', '--limit', '100', '--json', REPO_FIELDS.join(',')];
  let raw: ReadonlyArray<GithubRepoRef>;
  try {
    raw = await runJson<ReadonlyArray<GithubRepoRef>>(runner, args, opts);
  } catch (err) {
    if (err instanceof GhCliError) {
      if (UNAUTHENTICATED_PATTERN.test(err.stderr)) {
        return { kind: 'unauthenticated' };
      }
      const detail = err.stderr.trim();
      return { kind: 'failed', message: detail !== '' ? detail : err.message };
    }
    throw err;
  }
  return {
    kind: 'ok',
    repos: [...raw].sort((a, b) => a.nameWithOwner.localeCompare(b.nameWithOwner)),
  };
};
