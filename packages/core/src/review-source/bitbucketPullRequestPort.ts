import type {
  PrMergeMethod,
  PullRequestCommit,
  PullRequestPerson,
  PullRequestView,
} from '@goodboy/types';
import { parseUnifiedDiff } from '../github/diff';
import { bitbucketCheckRuns } from './bitbucketCheckRuns';
import {
  bitbucketPrStateKind,
  bitbucketReviewDecisionOf,
  bitbucketReviewerUuidsOf,
  bitbucketReviewersOf,
} from './bitbucketPullRequestFacts';
import type {
  BitbucketMergeStrategy,
  BitbucketPortCommit,
  BitbucketPortPullRequest,
  BitbucketPortStatus,
  BitbucketPortUser,
} from './bitbucketPullRequestTypes';
import {
  PULL_REQUEST_NOUNS,
  PullRequestPortError,
  PullRequestPortUnsupported,
  isPullRequestPortError,
  requirePullRequestCapability,
  type PullRequestPort,
} from './pullRequestPort';
import { HOST_CAPABILITIES } from './hostCapabilities';
import { REVIEW_SOURCE_CAPABILITIES, type ReviewSourceCapabilities } from './types';

export type BitbucketPullRequestTransport = Readonly<{
  readPullRequest: () => Promise<BitbucketPortPullRequest>;
  readStatuses: () => Promise<ReadonlyArray<BitbucketPortStatus>>;
  readCommits: () => Promise<ReadonlyArray<BitbucketPortCommit>>;
  readDiff: () => Promise<string>;
  updatePullRequest: (params: {
    readonly title?: string;
    readonly description?: string;
    readonly reviewerUuids?: ReadonlyArray<string>;
  }) => Promise<void>;
  merge: (params: { readonly strategy: BitbucketMergeStrategy }) => Promise<void>;
  decline: () => Promise<void>;
  searchMembers: (params: { readonly query: string }) => Promise<ReadonlyArray<BitbucketPortUser>>;
}>;

type Params = Readonly<{
  transport: BitbucketPullRequestTransport;
  prUrl: string | null;
  capabilities?: ReviewSourceCapabilities;
}>;

const FIRST_FILES = 7;

const MERGE_STRATEGY: Readonly<Record<PrMergeMethod, BitbucketMergeStrategy>> = {
  squash: 'squash',
  merge: 'merge_commit',
  rebase: 'rebase_merge',
};

const MERGE_METHODS: ReadonlyArray<PrMergeMethod> = HOST_CAPABILITIES.bitbucket.mergeMethods;

const personOf = ({ user }: { readonly user: BitbucketPortUser }): PullRequestPerson => ({
  login: user.nickname,
  name: user.displayName === '' ? null : user.displayName,
  avatarUrl: user.avatarUrl,
});

const commitOf = ({ commit }: { readonly commit: BitbucketPortCommit }): PullRequestCommit => ({
  sha: commit.hash,
  headline: commit.message,
  committedAt: commit.date,
  author: commit.author,
});

const checksOf = async ({
  transport,
  capabilities,
}: {
  readonly transport: BitbucketPullRequestTransport;
  readonly capabilities: ReviewSourceCapabilities;
}): Promise<PullRequestView['checks']> => {
  if (!capabilities.canReadChecks) {
    return { read: 'unsupported', error: null, runs: [] };
  }
  try {
    const statuses = await transport.readStatuses();
    return { read: 'ok', error: null, runs: bitbucketCheckRuns({ statuses }) };
  } catch (error) {
    if (!isPullRequestPortError(error)) {
      throw error;
    }
    return {
      read: error.kind === 'denied' ? 'denied' : 'failed',
      error: error.message,
      runs: [],
    };
  }
};

const commitsOf = async ({
  transport,
}: {
  readonly transport: BitbucketPullRequestTransport;
}): Promise<ReadonlyArray<PullRequestCommit>> => {
  try {
    return (await transport.readCommits()).map((commit) => commitOf({ commit }));
  } catch (error) {
    if (!isPullRequestPortError(error)) {
      throw error;
    }
    return [];
  }
};

export const bitbucketPullRequestPort = ({
  transport,
  prUrl,
  capabilities = REVIEW_SOURCE_CAPABILITIES.bitbucket,
}: Params): PullRequestPort => ({
  nouns: PULL_REQUEST_NOUNS.bitbucket,
  read: async () => {
    const [raw, checks, commits, diff] = await Promise.all([
      transport.readPullRequest(),
      checksOf({ transport, capabilities }),
      commitsOf({ transport }),
      transport.readDiff(),
    ]);
    const files = parseUnifiedDiff(diff);
    return {
      host: 'bitbucket',
      number: raw.id,
      title: raw.title,
      body: raw.description,
      url: raw.webUrl ?? prUrl ?? '',
      state: bitbucketPrStateKind({ state: raw.state }),
      isDraft: false,
      author: raw.author === null ? null : personOf({ user: raw.author }),
      baseBranch: raw.destinationBranch,
      headBranch: raw.sourceBranch,
      headSha: raw.sourceCommit,
      createdAt: raw.createdOn,
      updatedAt: raw.updatedOn,
      mergedAt: null,
      mergeable: null,
      reviewDecision: bitbucketReviewDecisionOf({ participants: raw.participants }),
      reviewers: bitbucketReviewersOf({ participants: raw.participants }),
      resolves: [],
      checks,
      files: {
        count: files.length,
        first: files.slice(0, FIRST_FILES).map((file) => ({
          path: file.path,
          additions: file.additions,
          deletions: file.deletions,
        })),
      },
      commits,
      mergeMethods: MERGE_METHODS,
      mergeMethodReasons: {},
    };
  },
  updateTitle: async ({ title }) => {
    requirePullRequestCapability({ capabilities, capability: 'canEditTitle' });
    await transport.updatePullRequest({ title });
  },
  updateBody: async ({ body }) => {
    requirePullRequestCapability({ capabilities, capability: 'canEditBody' });
    await transport.updatePullRequest({ description: body });
  },
  searchReviewers: async ({ query }) => {
    requirePullRequestCapability({ capabilities, capability: 'canRequestReviewers' });
    const members = await transport.searchMembers({ query });
    return members.map((user) => personOf({ user }));
  },
  requestReviewers: async ({ logins }) => {
    requirePullRequestCapability({ capabilities, capability: 'canRequestReviewers' });
    const wanted = logins.map((login) => login.trim()).filter((login) => login !== '');
    if (wanted.length === 0) {
      return;
    }
    const raw = await transport.readPullRequest();
    const found = await Promise.all(
      wanted.map(async (login) => {
        const members = await transport.searchMembers({ query: login });
        return {
          login,
          user:
            members.find((member) => member.nickname.toLowerCase() === login.toLowerCase()) ?? null,
        };
      }),
    );
    const unknown = found.filter((entry) => entry.user === null).map((entry) => entry.login);
    if (unknown.length > 0) {
      const message = `${unknown.join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not in this Bitbucket workspace`;
      throw new PullRequestPortError({ kind: 'failed', message, details: message });
    }
    const reviewerUuids = [
      ...new Set([
        ...bitbucketReviewerUuidsOf({ participants: raw.participants }),
        ...found.flatMap((entry) => (entry.user === null ? [] : [entry.user.uuid])),
      ]),
    ];
    await transport.updatePullRequest({ reviewerUuids });
  },
  setDraft: async () => {
    throw new PullRequestPortUnsupported({ capability: 'canSetDraft' });
  },
  merge: async ({ method }) => {
    await transport.merge({ strategy: MERGE_STRATEGY[method] });
  },
  close: async () => {
    requirePullRequestCapability({ capabilities, capability: 'canClose' });
    await transport.decline();
  },
  reopen: async () => {
    throw new PullRequestPortUnsupported({ capability: 'canReopen' });
  },
});
