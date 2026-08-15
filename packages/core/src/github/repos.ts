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

export type GithubRepoVisibility = 'public' | 'private';

const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

const REPO_NAME_MAX_LENGTH = 100;

const VISIBILITY_FLAG = {
  public: '--public',
  private: '--private',
} satisfies Record<GithubRepoVisibility, string>;

export type RepoNameCheck =
  | { readonly kind: 'ok'; readonly name: string }
  | { readonly kind: 'invalid'; readonly reason: string };

export type CreateRepoResult =
  | { readonly kind: 'ok'; readonly repo: GithubRepoRef }
  | { readonly kind: 'invalid-name'; readonly reason: string }
  | { readonly kind: 'unauthenticated' }
  | { readonly kind: 'failed'; readonly message: string };

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

export const validateGithubRepoName = ({ name }: { readonly name: string }): RepoNameCheck => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { kind: 'invalid', reason: 'Give the repository a name.' };
  }
  if (trimmed.startsWith('-')) {
    return { kind: 'invalid', reason: 'A repository name cannot start with a dash.' };
  }
  if (trimmed === '.' || trimmed === '..') {
    return { kind: 'invalid', reason: 'A repository name cannot be "." or "..".' };
  }
  if (trimmed.length > REPO_NAME_MAX_LENGTH) {
    return {
      kind: 'invalid',
      reason: `A repository name is at most ${REPO_NAME_MAX_LENGTH} characters.`,
    };
  }
  if (!REPO_NAME_PATTERN.test(trimmed)) {
    return {
      kind: 'invalid',
      reason: 'Use letters, numbers, dots, dashes and underscores only.',
    };
  }
  return { kind: 'ok', name: trimmed };
};

const failureFrom = ({ err }: { readonly err: unknown }): CreateRepoResult => {
  if (err instanceof GhCliError) {
    const detail = err.stderr.trim();
    return { kind: 'failed', message: detail !== '' ? detail : err.message };
  }
  return { kind: 'failed', message: err instanceof Error ? err.message : String(err) };
};

export const createGithubRepo = async ({
  runner,
  name,
  visibility,
  options = {},
}: {
  readonly runner: GhRunner;
  readonly name: string;
  readonly visibility: GithubRepoVisibility;
  readonly options?: GhRunOptions;
}): Promise<CreateRepoResult> => {
  const checked = validateGithubRepoName({ name });
  if (checked.kind !== 'ok') {
    return { kind: 'invalid-name', reason: checked.reason };
  }

  const created = await runner.run(
    ['repo', 'create', checked.name, VISIBILITY_FLAG[visibility]],
    options,
  );
  if (created.exitCode !== 0) {
    if (UNAUTHENTICATED_PATTERN.test(created.stderr)) {
      return { kind: 'unauthenticated' };
    }
    const detail = created.stderr.trim();
    return {
      kind: 'failed',
      message: detail !== '' ? detail : `gh repo create exited with ${created.exitCode}`,
    };
  }

  try {
    const repo = await runJson<GithubRepoRef>(
      runner,
      ['repo', 'view', checked.name, '--json', REPO_FIELDS.join(',')],
      options,
    );
    return { kind: 'ok', repo };
  } catch (err) {
    return failureFrom({ err });
  }
};
