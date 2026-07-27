import type { GhRunner, GhRunOptions } from './gh';
import { GhCliError, runJson } from './gh';

export type GithubRepoRef = {
  readonly nameWithOwner: string;
  readonly url: string;
  readonly sshUrl: string;
  readonly isPrivate: boolean;
};

const REPO_FIELDS = ['nameWithOwner', 'url', 'sshUrl', 'isPrivate'] as const;

export const listOwnedRepos = async (
  runner: GhRunner,
  opts: GhRunOptions = {},
): Promise<ReadonlyArray<GithubRepoRef>> => {
  const args = ['repo', 'list', '--limit', '100', '--json', REPO_FIELDS.join(',')];
  let raw: ReadonlyArray<GithubRepoRef>;
  try {
    raw = await runJson<ReadonlyArray<GithubRepoRef>>(runner, args, opts);
  } catch (err) {
    if (err instanceof GhCliError) {
      return [];
    }
    throw err;
  }
  return [...raw].sort((a, b) => a.nameWithOwner.localeCompare(b.nameWithOwner));
};
