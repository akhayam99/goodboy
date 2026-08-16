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

export type ExpectedRepo = {
  readonly nameWithOwner: string;
  readonly isPrivate: boolean;
};

export type CreateRepoResult =
  | { readonly kind: 'ok'; readonly repo: GithubRepoRef }
  | { readonly kind: 'invalid-name'; readonly reason: string }
  | { readonly kind: 'unauthenticated' }
  | {
      readonly kind: 'mismatch';
      readonly expected: ExpectedRepo;
      readonly actual: GithubRepoRef;
    }
  | {
      readonly kind: 'unverified';
      readonly nameWithOwner: string | null;
      readonly message: string;
    }
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

const CREATED_SLUG_PATTERN = /https?:\/\/[^/\s]+\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)/;

type OwnerFromCreateOutputParams = {
  readonly stdout: string;
  readonly name: string;
};

const ownerFromCreateOutput = ({ stdout, name }: OwnerFromCreateOutputParams): string | null => {
  const matched = CREATED_SLUG_PATTERN.exec(stdout);
  if (matched === null) {
    return null;
  }

  const [, owner, created] = matched;
  if (owner == null || created !== name) {
    return null;
  }

  return owner;
};

type CreateGithubRepoParams = {
  readonly runner: GhRunner;
  readonly name: string;
  readonly owner: string | null;
  readonly visibility: GithubRepoVisibility;
  readonly options?: GhRunOptions;
};

export const createGithubRepo = async ({
  runner,
  name,
  owner,
  visibility,
  options = {},
}: CreateGithubRepoParams): Promise<CreateRepoResult> => {
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

  const trimmedOwner = owner === null ? '' : owner.trim();
  const sessionOwner = trimmedOwner !== '' ? trimmedOwner : null;
  const createdOwner = ownerFromCreateOutput({ stdout: created.stdout, name: checked.name });
  const pinnedOwner = createdOwner ?? sessionOwner;
  if (pinnedOwner === null) {
    return {
      kind: 'unverified',
      nameWithOwner: null,
      message: `Goodboy created ${checked.name} on GitHub but could not tell which account it landed on, so it did not read the repository back. It exists on GitHub and was not removed.`,
    };
  }

  const pinnedSlug = `${pinnedOwner}/${checked.name}`;
  const expected: ExpectedRepo = {
    nameWithOwner: `${sessionOwner ?? pinnedOwner}/${checked.name}`,
    isPrivate: visibility === 'private',
  };

  let repo: GithubRepoRef;
  try {
    repo = await runJson<GithubRepoRef>(
      runner,
      ['repo', 'view', pinnedSlug, '--json', REPO_FIELDS.join(',')],
      options,
    );
  } catch (err) {
    const failure = failureFrom({ err });
    return {
      kind: 'unverified',
      nameWithOwner: pinnedSlug,
      message: `Goodboy created ${pinnedSlug} on GitHub but could not read it back: ${failure.kind === 'failed' ? failure.message : 'gh repo view failed'}. It exists on GitHub and was not removed.`,
    };
  }

  if (repo.nameWithOwner !== expected.nameWithOwner || repo.isPrivate !== expected.isPrivate) {
    return { kind: 'mismatch', expected, actual: repo };
  }

  return { kind: 'ok', repo };
};
