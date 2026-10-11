import type {
  PrMergeMethod,
  PullRequestCommit,
  PullRequestPerson,
  PullRequestResolve,
  PullRequestView,
} from '@goodboy/types';
import { classifyGhFailure } from '../github/classifyGhFailure';
import { fetchPrReadStates, type PrReadStates } from '../github/details';
import type { GhResult, GhRunOptions, GhRunner } from '../github/gh';
import { GhCliError, GhJsonParseError, runJson } from '../github/gh';
import { toPullRequestState, type RawPullRequest } from '../github/resolver';
import {
  PULL_REQUEST_NOUNS,
  PullRequestPortError,
  requirePullRequestCapability,
  type PullRequestFailureKind,
  type PullRequestPort,
} from './pullRequestPort';
import { HOST_CAPABILITIES } from './hostCapabilities';
import { pullRequestReviewersOf } from './pullRequestReviewers';
import { REVIEW_SOURCE_CAPABILITIES, type ReviewSourceCapabilities } from './types';

type Params = Readonly<{
  runner: GhRunner;
  repo: string;
  prNumber: number;
  prUrl: string | null;
  options?: GhRunOptions;
  capabilities?: ReviewSourceCapabilities;
}>;

const VIEW_FIELDS = [
  'number',
  'title',
  'body',
  'url',
  'state',
  'isDraft',
  'author',
  'baseRefName',
  'headRefName',
  'headRefOid',
  'createdAt',
  'updatedAt',
  'mergedAt',
  'mergeable',
  'reviewDecision',
  'autoMergeRequest',
  'closingIssuesReferences',
  'commits',
  'files',
].join(',');

const FIRST_FILES = 7;

const REPO_OF_URL = /^https?:\/\/[^/]+\/([^/]+\/[^/]+)\/pull\/\d+/;

const COLLABORATORS_JQ = '.[] | [.login, .avatar_url] | @tsv';

const MERGE_FLAG: Readonly<Record<PrMergeMethod, string>> = {
  squash: '--squash',
  merge: '--merge',
  rebase: '--rebase',
};

const MERGE_METHOD_ORDER: ReadonlyArray<PrMergeMethod> = HOST_CAPABILITIES.github.mergeMethods;

type RawView = RawPullRequest & {
  readonly createdAt?: string | null;
  readonly author?: {
    readonly login?: string | null;
    readonly name?: string | null;
  } | null;
  readonly closingIssuesReferences?: ReadonlyArray<{
    readonly number: number;
    readonly url?: string | null;
  }> | null;
  readonly commits?: ReadonlyArray<{
    readonly oid: string;
    readonly messageHeadline?: string | null;
    readonly committedDate?: string | null;
    readonly authors?: ReadonlyArray<{
      readonly login?: string | null;
      readonly name?: string | null;
    }> | null;
  }> | null;
  readonly files?: ReadonlyArray<{
    readonly path: string;
    readonly additions?: number | null;
    readonly deletions?: number | null;
  }> | null;
};

type RawRepoMethods = {
  readonly squashMergeAllowed?: boolean | null;
  readonly mergeCommitAllowed?: boolean | null;
  readonly rebaseMergeAllowed?: boolean | null;
};

const FAILURE_KIND: Readonly<Record<ReturnType<typeof classifyGhFailure>, PullRequestFailureKind>> =
  {
    denied: 'denied',
    auth: 'denied',
    'rate-limited': 'rate_limited',
    network: 'network',
    failed: 'failed',
  };

const portError = ({
  stderr,
  fallback,
}: {
  readonly stderr: string;
  readonly fallback: string;
}): PullRequestPortError => {
  const details = stderr.trim();
  return new PullRequestPortError({
    kind: FAILURE_KIND[classifyGhFailure({ stderr: details })],
    message: details === '' ? fallback : details,
    details,
  });
};

const reachedHost = async ({
  run,
  fallback,
}: {
  readonly run: () => Promise<GhResult>;
  readonly fallback: string;
}): Promise<GhResult> => {
  try {
    return await run();
  } catch (err) {
    throw portError({ stderr: messageOf({ error: err }), fallback });
  }
};

const messageOf = ({ error }: { readonly error: unknown }): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : 'The host did not answer';
};

const repoNameOf = ({ repo }: { readonly repo: string }): string =>
  repo.split('/')[1] ?? 'this repository';

const personOf = ({
  login,
  name,
  avatarUrl,
}: {
  readonly login: string;
  readonly name?: string | null;
  readonly avatarUrl?: string | null;
}): PullRequestPerson => ({ login, name: name ?? null, avatarUrl: avatarUrl ?? null });

const resolvesOf = ({ raw }: { readonly raw: RawView }): ReadonlyArray<PullRequestResolve> =>
  (raw.closingIssuesReferences ?? []).map((reference) => ({
    label: `#${reference.number}`,
    url: reference.url ?? null,
    isClosing: true,
  }));

const commitsOf = ({ raw }: { readonly raw: RawView }): ReadonlyArray<PullRequestCommit> =>
  (raw.commits ?? []).map((commit) => {
    const author = commit.authors?.[0] ?? null;
    return {
      sha: commit.oid,
      headline: commit.messageHeadline ?? '',
      committedAt: commit.committedDate ?? '',
      author: author?.login ?? author?.name ?? null,
    };
  });

const checksOf = ({
  states,
  capabilities,
}: {
  readonly states: PrReadStates;
  readonly capabilities: ReviewSourceCapabilities;
}): PullRequestView['checks'] => {
  if (!capabilities.canReadChecks) {
    return { read: 'unsupported', error: null, runs: [] };
  }
  return {
    read: states.checksRead ?? 'ok',
    error: states.checksError ?? null,
    runs: states.checks ?? [],
  };
};

export const githubPullRequestPort = ({
  runner,
  repo,
  prNumber,
  prUrl,
  options = {},
  capabilities = REVIEW_SOURCE_CAPABILITIES.github,
}: Params): PullRequestPort => {
  const slug = repo !== '' ? repo : (REPO_OF_URL.exec(prUrl ?? '')?.[1] ?? '');
  const number = String(prNumber);
  const repoFlags = slug === '' ? [] : ['--repo', slug];

  const write = async ({ args }: { readonly args: ReadonlyArray<string> }): Promise<void> => {
    const verb = `gh ${args.slice(0, 2).join(' ')}`;
    const res = await reachedHost({
      run: () => runner.run(args, options),
      fallback: `${verb} failed`,
    });
    if (res.exitCode !== 0) {
      throw portError({ stderr: res.stderr, fallback: `${verb} exited with ${res.exitCode}` });
    }
  };

  const view = async (): Promise<RawView> => {
    try {
      return await runJson<RawView>({
        runner,
        args: ['pr', 'view', number, ...repoFlags, '--json', VIEW_FIELDS],
        opts: options,
        shape: 'object',
      });
    } catch (err) {
      if (err instanceof GhCliError) {
        throw portError({ stderr: err.stderr, fallback: err.message });
      }
      if (err instanceof GhJsonParseError) {
        throw portError({ stderr: err.message, fallback: err.message });
      }
      throw portError({
        stderr: messageOf({ error: err }),
        fallback: 'gh pr view failed',
      });
    }
  };

  const states = (): Promise<PrReadStates> =>
    slug === ''
      ? Promise.reject(
          portError({ stderr: '', fallback: 'This pull request has no repository to read' }),
        )
      : fetchPrReadStates(runner, slug, prNumber, options);

  const mergeMethods = async (): Promise<
    Pick<PullRequestView, 'mergeMethods' | 'mergeMethodReasons'>
  > => {
    try {
      const raw = await runJson<RawRepoMethods>({
        runner,
        args: [
          'repo',
          'view',
          ...(slug === '' ? [] : [slug]),
          '--json',
          'squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed',
        ],
        opts: options,
        shape: 'object',
      });
      const allowed: Readonly<Record<PrMergeMethod, boolean>> = {
        squash: raw.squashMergeAllowed !== false,
        merge: raw.mergeCommitAllowed !== false,
        rebase: raw.rebaseMergeAllowed !== false,
      };
      const reason = `Turned off in ${repoNameOf({ repo: slug })}`;
      return {
        mergeMethods: MERGE_METHOD_ORDER.filter((method) => allowed[method]),
        mergeMethodReasons: Object.fromEntries(
          MERGE_METHOD_ORDER.filter((method) => !allowed[method]).map((method) => [method, reason]),
        ),
      };
    } catch (err) {
      if (err instanceof GhCliError || err instanceof GhJsonParseError) {
        return { mergeMethods: MERGE_METHOD_ORDER, mergeMethodReasons: {} };
      }
      throw err;
    }
  };

  return {
    nouns: PULL_REQUEST_NOUNS.github,
    read: async () => {
      const [raw, read, methods] = await Promise.all([view(), states(), mergeMethods()]);
      const state = toPullRequestState({
        raw: { ...raw, body: raw.body ?? '', updatedAt: raw.updatedAt },
      });
      const files = raw.files ?? [];
      return {
        host: 'github',
        number: raw.number,
        title: raw.title,
        body: raw.body ?? '',
        url: raw.url,
        state: state.state,
        isDraft: raw.isDraft,
        author:
          raw.author?.login == null
            ? null
            : personOf({ login: raw.author.login, name: raw.author.name }),
        baseBranch: raw.baseRefName,
        headBranch: raw.headRefName,
        headSha: raw.headRefOid ?? null,
        createdAt: raw.createdAt ?? raw.updatedAt,
        updatedAt: raw.updatedAt,
        mergedAt: raw.mergedAt ?? null,
        mergeable: state.mergeable,
        reviewDecision: state.reviewDecision,
        reviewers: pullRequestReviewersOf({ reviews: read.reviews, requests: read.reviewRequests }),
        resolves: resolvesOf({ raw }),
        checks: checksOf({ states: read, capabilities }),
        files: {
          count: files.length,
          first: files.slice(0, FIRST_FILES).map((file) => ({
            path: file.path,
            additions: file.additions ?? 0,
            deletions: file.deletions ?? 0,
          })),
        },
        commits: commitsOf({ raw }),
        mergeMethods: methods.mergeMethods,
        mergeMethodReasons: methods.mergeMethodReasons,
      };
    },
    updateTitle: async ({ title }) => {
      requirePullRequestCapability({ capabilities, capability: 'canEditTitle' });
      await write({
        args: ['pr', 'edit', number, '--title', title],
      });
    },
    updateBody: async ({ body }) => {
      requirePullRequestCapability({ capabilities, capability: 'canEditBody' });
      await write({
        args: ['pr', 'edit', number, '--body', body],
      });
    },
    searchReviewers: async ({ query }) => {
      requirePullRequestCapability({ capabilities, capability: 'canRequestReviewers' });
      const res = await reachedHost({
        run: () =>
          runner.run(
            [
              'api',
              `repos/${slug === '' ? '{owner}/{repo}' : slug}/collaborators?per_page=100`,
              '--jq',
              COLLABORATORS_JQ,
            ],
            options,
          ),
        fallback: 'gh api collaborators failed',
      });
      if (res.exitCode !== 0) {
        throw portError({ stderr: res.stderr, fallback: 'gh api collaborators failed' });
      }
      const needle = query.trim().toLowerCase();
      return res.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .map((line) => {
          const [login = '', avatar = ''] = line.split('\t');
          return personOf({ login, avatarUrl: avatar === '' ? null : avatar });
        })
        .filter((person) => person.login !== '' && person.login.toLowerCase().includes(needle));
    },
    requestReviewers: async ({ logins }) => {
      requirePullRequestCapability({ capabilities, capability: 'canRequestReviewers' });
      const clean = logins.map((login) => login.trim()).filter((login) => login !== '');
      if (clean.length === 0) {
        return;
      }
      await write({
        args: ['pr', 'edit', number, '--add-reviewer', clean.join(',')],
      });
    },
    setDraft: async ({ isDraft }) => {
      requirePullRequestCapability({ capabilities, capability: 'canSetDraft' });
      await write({
        args: isDraft ? ['pr', 'ready', number, '--undo'] : ['pr', 'ready', number],
      });
    },
    merge: async ({ method }) => {
      await write({
        args: ['pr', 'merge', number, MERGE_FLAG[method]],
      });
    },
    close: async () => {
      requirePullRequestCapability({ capabilities, capability: 'canClose' });
      await write({
        args: ['pr', 'close', number],
      });
    },
    reopen: async () => {
      requirePullRequestCapability({ capabilities, capability: 'canReopen' });
      await write({
        args: ['pr', 'reopen', number],
      });
    },
  };
};
