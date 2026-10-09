import type {
  PrCheckConclusion,
  PrCheckRun,
  PrMergeMethod,
  PullRequestCommit,
  PullRequestPerson,
  PullRequestReviewDecision,
  PullRequestReviewer,
  PullRequestStateKind,
  PullRequestView,
} from '@goodboy/types';
import { parseUnifiedDiff } from '../github/diff';
import { gitlabDraftTitle, stripGitlabDraftPrefix } from './gitlabDraftTitle';
import {
  PULL_REQUEST_NOUNS,
  PullRequestPortError,
  isPullRequestPortError,
  requirePullRequestCapability,
  type PullRequestPort,
} from './pullRequestPort';
import { REVIEW_SOURCE_CAPABILITIES, type ReviewSourceCapabilities } from './types';

export type GitlabPersonPayload = Readonly<{
  id?: number | null;
  username: string;
  name: string;
  avatarUrl?: string | null;
}>;

export type GitlabMergeRequestPayload = Readonly<{
  iid: number;
  title: string;
  description: string | null;
  state: string;
  webUrl: string;
  sourceBranch: string;
  targetBranch: string;
  draft: boolean;
  hasConflicts: boolean;
  mergeStatus: string | null;
  updatedAt: string;
  createdAt?: string | null;
  sha?: string | null;
  mergedAt?: string | null;
  author?: GitlabPersonPayload | null;
  reviewers?: ReadonlyArray<GitlabPersonPayload> | null;
}>;

export type GitlabApprovalsPayload = Readonly<{
  approvalsLeft: number;
  approvedBy: ReadonlyArray<Readonly<{ user: GitlabPersonPayload }>>;
}>;

export type GitlabCommitPayload = Readonly<{
  id: string;
  title: string;
  authorName: string | null;
  committedDate: string | null;
}>;

export type GitlabJobPayload = Readonly<{
  id: number;
  name: string;
  status: string;
  webUrl: string | null;
  allowFailure: boolean;
  duration: number | null;
}>;

export type GitlabChecksPayload = Readonly<{
  pipeline: Readonly<{ id: number; status: string }> | null;
  jobs: ReadonlyArray<GitlabJobPayload>;
}>;

export type GitlabMergeSettingsPayload = Readonly<{
  mergeMethod: string;
  squashOption: string | null;
  onlyAllowMergeIfPipelineSucceeds: boolean;
}>;

export type GitlabMergeStateEvent = 'close' | 'reopen';

export type GitlabPullRequestTransport = Readonly<{
  readMergeRequest: () => Promise<GitlabMergeRequestPayload>;
  readCommits: () => Promise<ReadonlyArray<GitlabCommitPayload>>;
  readChanges: () => Promise<string>;
  readApprovals: () => Promise<GitlabApprovalsPayload | null>;
  readPipelineJobs: () => Promise<GitlabChecksPayload | null>;
  updateMergeRequest: (params: {
    readonly title?: string;
    readonly description?: string;
    readonly reviewerIds?: ReadonlyArray<number>;
  }) => Promise<void>;
  setState: (params: { readonly stateEvent: GitlabMergeStateEvent }) => Promise<void>;
  merge: (params: { readonly method: PrMergeMethod }) => Promise<void>;
  projectMergeSettings: () => Promise<GitlabMergeSettingsPayload>;
  searchUsers: (params: { readonly query: string }) => Promise<ReadonlyArray<GitlabPersonPayload>>;
}>;

type Params = Readonly<{
  transport: GitlabPullRequestTransport;
  mrUrl: string | null;
  capabilities?: ReviewSourceCapabilities;
}>;

const FIRST_FILES = 7;

const MERGE_METHOD_ORDER: ReadonlyArray<PrMergeMethod> = ['squash', 'merge', 'rebase'];

const SET_BY_THE_PROJECT = 'Set by the project';

const JOB_CONCLUSIONS: Readonly<Record<string, PrCheckConclusion>> = {
  success: 'success',
  failed: 'failure',
  running: 'pending',
  pending: 'pending',
  created: 'pending',
  preparing: 'pending',
  scheduled: 'pending',
  waiting_for_resource: 'pending',
  canceled: 'cancelled',
  canceling: 'cancelled',
  skipped: 'skipped',
  manual: 'neutral',
};

export const gitlabJobConclusion = ({
  status,
  allowFailure = false,
}: {
  readonly status: string;
  readonly allowFailure?: boolean;
}): PrCheckConclusion => {
  const conclusion = JOB_CONCLUSIONS[status] ?? 'unknown';
  return conclusion === 'failure' && allowFailure ? 'neutral' : conclusion;
};

export const gitlabStateKindOf = ({
  state,
  draft,
}: {
  readonly state: string;
  readonly draft: boolean;
}): PullRequestStateKind => {
  if (state === 'merged') {
    return 'merged';
  }
  if (state === 'closed') {
    return 'closed';
  }
  if (state === 'locked') {
    return 'queued';
  }
  return draft ? 'draft' : 'open';
};

export const gitlabMergeableOf = ({
  hasConflicts,
  mergeStatus,
}: {
  readonly hasConflicts: boolean;
  readonly mergeStatus: string | null | undefined;
}): boolean | null => {
  if (hasConflicts || mergeStatus === 'cannot_be_merged') {
    return false;
  }
  if (mergeStatus === 'checking' || mergeStatus === 'unchecked') {
    return null;
  }
  if (mergeStatus === 'cannot_be_merged_recheck') {
    return null;
  }
  return true;
};

export const gitlabReviewDecisionOf = ({
  approvals,
}: {
  readonly approvals: GitlabApprovalsPayload | null;
}): PullRequestReviewDecision | null => {
  if (approvals === null) {
    return null;
  }
  if (approvals.approvalsLeft > 0) {
    return 'review_required';
  }
  return approvals.approvedBy.length > 0 ? 'approved' : null;
};

export const gitlabMergeMethodsOf = ({
  settings,
}: {
  readonly settings: GitlabMergeSettingsPayload;
}): Pick<PullRequestView, 'mergeMethods' | 'mergeMethodReasons'> => {
  const squashRequired = settings.squashOption === 'always';
  const allowed: Readonly<Record<PrMergeMethod, boolean>> = {
    squash: settings.squashOption !== 'never',
    merge:
      !squashRequired &&
      (settings.mergeMethod === 'merge' || settings.mergeMethod === 'rebase_merge'),
    rebase: !squashRequired && settings.mergeMethod === 'ff',
  };
  const preferred: PrMergeMethod = settings.mergeMethod === 'ff' ? 'rebase' : 'merge';
  const ordered = [
    preferred,
    ...MERGE_METHOD_ORDER.filter((method) => method !== preferred),
  ].filter((method) => allowed[method]);
  return {
    mergeMethods: ordered,
    mergeMethodReasons: Object.fromEntries(
      MERGE_METHOD_ORDER.filter((method) => !allowed[method]).map((method) => [
        method,
        SET_BY_THE_PROJECT,
      ]),
    ),
  };
};

const FALLBACK_MERGE_METHODS: Pick<PullRequestView, 'mergeMethods' | 'mergeMethodReasons'> = {
  mergeMethods: ['merge', 'squash'],
  mergeMethodReasons: {},
};

const personOf = ({ person }: { readonly person: GitlabPersonPayload }): PullRequestPerson => ({
  login: person.username,
  name: person.name === '' ? null : person.name,
  avatarUrl: person.avatarUrl ?? null,
});

export const gitlabReviewersOf = ({
  reviewers,
  approvals,
}: {
  readonly reviewers: ReadonlyArray<GitlabPersonPayload>;
  readonly approvals: GitlabApprovalsPayload | null;
}): ReadonlyArray<PullRequestReviewer> => {
  const approvers = (approvals?.approvedBy ?? []).map((entry) => entry.user);
  const approved = new Set(approvers.map((user) => user.username.toLowerCase()));
  const listed = new Set(reviewers.map((user) => user.username.toLowerCase()));
  return [
    ...reviewers.map((user) => ({
      person: personOf({ person: user }),
      state: approved.has(user.username.toLowerCase())
        ? ('approved' as const)
        : ('pending' as const),
    })),
    ...approvers
      .filter((user) => !listed.has(user.username.toLowerCase()))
      .map((user) => ({ person: personOf({ person: user }), state: 'approved' as const })),
  ];
};

export const gitlabJobRunOf = ({ job }: { readonly job: GitlabJobPayload }): PrCheckRun => ({
  name: job.name,
  conclusion: gitlabJobConclusion({ status: job.status, allowFailure: job.allowFailure }),
  detailsUrl: job.webUrl,
  durationMs: job.duration === null ? null : Math.round(job.duration * 1000),
});

const commitsOf = ({
  commits,
}: {
  readonly commits: ReadonlyArray<GitlabCommitPayload>;
}): ReadonlyArray<PullRequestCommit> =>
  [...commits].reverse().map((commit) => ({
    sha: commit.id,
    headline: commit.title,
    committedAt: commit.committedDate ?? '',
    author: commit.authorName,
  }));

const messageOf = ({ error }: { readonly error: unknown }): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : 'GitLab did not answer';
};

const portErrorOf = ({ error }: { readonly error: unknown }): PullRequestPortError => {
  if (isPullRequestPortError(error)) {
    return error;
  }
  const details = messageOf({ error }).trim();
  return new PullRequestPortError({ kind: 'failed', message: details, details });
};

const reached = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    throw portErrorOf({ error });
  }
};

const softly = async <T>({
  run,
  fallback,
}: {
  readonly run: () => Promise<T>;
  readonly fallback: T;
}): Promise<T> => {
  try {
    return await run();
  } catch {
    return fallback;
  }
};

export const gitlabPullRequestPort = ({
  transport,
  mrUrl,
  capabilities = REVIEW_SOURCE_CAPABILITIES.gitlab,
}: Params): PullRequestPort => {
  const readChecks = async (): Promise<PullRequestView['checks']> => {
    if (!capabilities.canReadChecks) {
      return { read: 'unsupported', error: null, runs: [] };
    }
    try {
      const checks = await transport.readPipelineJobs();
      if (checks === null) {
        return { read: 'denied', error: null, runs: [] };
      }
      return { read: 'ok', error: null, runs: checks.jobs.map((job) => gitlabJobRunOf({ job })) };
    } catch (error) {
      const failure = portErrorOf({ error });
      return {
        read: failure.kind === 'denied' ? 'denied' : 'failed',
        error: failure.details === '' ? null : failure.details,
        runs: [],
      };
    }
  };

  const draftTitleOf = async ({ isDraft }: { readonly isDraft: boolean }): Promise<string> => {
    const mr = await reached(() => transport.readMergeRequest());
    return gitlabDraftTitle({ title: mr.title, isDraft });
  };

  const write = <T>(run: () => Promise<T>): Promise<T> => reached(run);

  return {
    nouns: PULL_REQUEST_NOUNS.gitlab,
    read: async () => {
      const mr = await reached(() => transport.readMergeRequest());
      const [approvals, commits, changes, settings, checks] = await Promise.all([
        softly({ run: () => transport.readApprovals(), fallback: null }),
        softly({ run: () => transport.readCommits(), fallback: [] }),
        softly({ run: () => transport.readChanges(), fallback: '' }),
        softly({
          run: async () =>
            gitlabMergeMethodsOf({ settings: await transport.projectMergeSettings() }),
          fallback: FALLBACK_MERGE_METHODS,
        }),
        readChecks(),
      ]);
      const files = parseUnifiedDiff(changes);
      const url = mr.webUrl === '' ? (mrUrl ?? '') : mr.webUrl;
      return {
        host: 'gitlab',
        number: mr.iid,
        title: stripGitlabDraftPrefix({ title: mr.title }),
        body: mr.description ?? '',
        url,
        state: gitlabStateKindOf({ state: mr.state, draft: mr.draft }),
        isDraft: mr.draft,
        author: mr.author == null ? null : personOf({ person: mr.author }),
        baseBranch: mr.targetBranch,
        headBranch: mr.sourceBranch,
        headSha: mr.sha ?? null,
        createdAt: mr.createdAt ?? mr.updatedAt,
        updatedAt: mr.updatedAt,
        mergedAt: mr.mergedAt ?? null,
        mergeable: gitlabMergeableOf({
          hasConflicts: mr.hasConflicts,
          mergeStatus: mr.mergeStatus,
        }),
        reviewDecision: gitlabReviewDecisionOf({ approvals }),
        reviewers: gitlabReviewersOf({ reviewers: mr.reviewers ?? [], approvals }),
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
        commits: commitsOf({ commits }),
        mergeMethods: settings.mergeMethods,
        mergeMethodReasons: settings.mergeMethodReasons,
      };
    },
    updateTitle: async ({ title }) => {
      requirePullRequestCapability({ capabilities, capability: 'canEditTitle' });
      const mr = await reached(() => transport.readMergeRequest());
      await write(() =>
        transport.updateMergeRequest({ title: gitlabDraftTitle({ title, isDraft: mr.draft }) }),
      );
    },
    updateBody: async ({ body }) => {
      requirePullRequestCapability({ capabilities, capability: 'canEditBody' });
      await write(() => transport.updateMergeRequest({ description: body }));
    },
    searchReviewers: async ({ query }) => {
      requirePullRequestCapability({ capabilities, capability: 'canRequestReviewers' });
      const users = await write(() => transport.searchUsers({ query }));
      return users.map((user) => personOf({ person: user }));
    },
    requestReviewers: async ({ logins }) => {
      requirePullRequestCapability({ capabilities, capability: 'canRequestReviewers' });
      const wanted = logins.map((login) => login.trim()).filter((login) => login !== '');
      if (wanted.length === 0) {
        return;
      }
      const mr = await reached(() => transport.readMergeRequest());
      const current = (mr.reviewers ?? []).flatMap((user) => (user.id == null ? [] : [user.id]));
      const added = await Promise.all(
        wanted.map(async (login) => {
          const users = await write(() => transport.searchUsers({ query: login }));
          const match = users.find((user) => user.username.toLowerCase() === login.toLowerCase());
          if (match?.id == null) {
            throw new PullRequestPortError({
              kind: 'failed',
              message: `No GitLab user named ${login} in this project`,
              details: '',
            });
          }
          return match.id;
        }),
      );
      await write(() =>
        transport.updateMergeRequest({ reviewerIds: [...new Set([...current, ...added])] }),
      );
    },
    setDraft: async ({ isDraft }) => {
      requirePullRequestCapability({ capabilities, capability: 'canSetDraft' });
      const title = await draftTitleOf({ isDraft });
      await write(() => transport.updateMergeRequest({ title }));
    },
    merge: async ({ method }) => {
      await write(() => transport.merge({ method }));
    },
    close: async () => {
      requirePullRequestCapability({ capabilities, capability: 'canClose' });
      await write(() => transport.setState({ stateEvent: 'close' }));
    },
    reopen: async () => {
      requirePullRequestCapability({ capabilities, capability: 'canReopen' });
      await write(() => transport.setState({ stateEvent: 'reopen' }));
    },
  };
};
