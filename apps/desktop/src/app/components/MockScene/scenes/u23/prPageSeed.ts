import type {
  MountId,
  PrCheckRun,
  PrDetail,
  PrReview,
  PrReviewRequest,
  Project,
  ProjectId,
  PullRequestState,
  PullRequestView,
  SessionProjectMount,
  WorktreeStatus,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { MountGithubState } from '../../../../../store/types';
import { handlersFor } from '../brand/DiffStage';
import { BRANCH_FILES_PATCH } from '../brand/contextDiffPatch';
import { CTX_STATUS } from '../brand/contextBranch';
import type { FakeHandlers } from '../brand/fakeTauri';
import { mockSceneIpc } from '../mockSceneIpc';
import {
  NOW_ISO,
  RESOLVE_SCENE_PR,
  SESSION_ID,
  WORKSPACE_ID,
  isoAgo,
  seedResolveScene,
} from '../resolveSeed';

export type PrPageVariant =
  'github' | 'draft' | 'editing' | 'none' | 'merge-blocked' | 'merge-methods' | 'narrow' | 'merged';

const PROJECT_ID = 'mock-u23-project-payments-api' as ProjectId;
const MOUNT_ID = 'mock-u23-mount-fix-duplicate-credit' as MountId;
export const PR_PAGE_WORKTREE = '~/code/harborline/payments-api-fix-duplicate-credit';
const PR_URL = 'https://github.com/harborline/payments-api/pull/318';
const DAY = 1440;

const PR_BODY = [
  'Retried webhooks posted a second credit because the guard keyed on the delivery id. A redelivery carries a new delivery id, so it slipped through.',
  '',
  '- Key the guard on the event id, stored as `idempotencyKey` on `LedgerPost`',
  '- `applyWebhook` answers 200 with `credited: false` for an event it has seen',
  '- Drop the `seenEvents` read from the hot path',
  '',
  'Retries stay at **3**. Closes #412',
].join('\n');

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: PR_PAGE_WORKTREE,
  lastWorktreePath: null,
  repoRoot: '~/code/harborline/payments-api',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const run = ({
  name,
  conclusion,
}: {
  readonly name: string;
  readonly conclusion: PrCheckRun['conclusion'];
}): PrCheckRun => ({
  name,
  conclusion,
  durationMs: 60_000,
  detailsUrl: `https://github.com/harborline/payments-api/actions/runs/${encodeURIComponent(name)}`,
});

const PASSING: ReadonlyArray<PrCheckRun> = [
  run({ name: 'build', conclusion: 'success' }),
  run({ name: 'types', conclusion: 'success' }),
  run({ name: 'unit tests', conclusion: 'success' }),
  run({ name: 'contract tests', conclusion: 'success' }),
  run({ name: 'migrations dry run', conclusion: 'success' }),
];

const FAILING: ReadonlyArray<PrCheckRun> = [
  run({ name: 'lint', conclusion: 'failure' }),
  ...PASSING,
  run({ name: 'integration tests', conclusion: 'pending' }),
];

const TWO_FAILING: ReadonlyArray<PrCheckRun> = [
  run({ name: 'lint', conclusion: 'failure' }),
  run({ name: 'contract tests', conclusion: 'timed_out' }),
  run({ name: 'build', conclusion: 'success' }),
  run({ name: 'types', conclusion: 'success' }),
  run({ name: 'unit tests', conclusion: 'success' }),
];

const RUNNING: ReadonlyArray<PrCheckRun> = [
  ...PASSING,
  run({ name: 'integration tests', conclusion: 'pending' }),
  run({ name: 'docs preview', conclusion: 'pending' }),
];

const reviewOf = ({
  id,
  author,
  state,
  minutes,
  body,
}: {
  readonly id: string;
  readonly author: string;
  readonly state: PrReview['state'];
  readonly minutes: number;
  readonly body: string;
}): PrReview => ({
  id,
  author,
  authorAvatarUrl: null,
  state,
  submittedAt: isoAgo({ minutes }),
  body,
});

const REVIEWS_BLOCKING: ReadonlyArray<PrReview> = [
  reviewOf({
    id: 'review-omar',
    author: 'omar-t',
    state: 'changes_requested',
    minutes: 4 * DAY,
    body: 'The guard still reads `seenEvents` on the hot path. Please drop it before this ships.',
  }),
  reviewOf({
    id: 'review-kenji',
    author: 'kenji-w',
    state: 'approved',
    minutes: 2 * DAY,
    body: 'The event id is the right key.',
  }),
];

const REVIEWS_APPROVED: ReadonlyArray<PrReview> = [
  reviewOf({
    id: 'review-kenji',
    author: 'kenji-w',
    state: 'approved',
    minutes: 2 * DAY,
    body: 'The event id is the right key.',
  }),
  reviewOf({ id: 'review-omar', author: 'omar-t', state: 'approved', minutes: DAY, body: '' }),
];

const REQUEST_PRIYA: ReadonlyArray<PrReviewRequest> = [
  { login: 'priya-n', avatarUrl: null, kind: 'user' },
];

const FILES = [
  { path: 'src/ledger/ledgerClient.ts', additions: 12, deletions: 4 },
  { path: 'src/ledger/postCredit.ts', additions: 18, deletions: 6 },
  { path: 'src/webhooks/applyWebhook.ts', additions: 34, deletions: 20 },
  { path: 'src/webhooks/seenEvents.ts', additions: 0, deletions: 11 },
  { path: 'test/applyWebhook.test.ts', additions: 22, deletions: 0 },
] as const;

const COMMITS = [
  { sha: '6c20f48a9e1', headline: 'Key the credit guard on the event id', minutes: 11 * DAY },
  { sha: '2d8b1c70e4f', headline: 'Store the key on LedgerPost', minutes: 11 * DAY - 40 },
  { sha: '9f13a7be2c5', headline: 'Answer 200 for a seen event', minutes: 11 * DAY - 90 },
  { sha: '3e7c5a90b21', headline: 'Add the retry test', minutes: 3 * DAY },
  { sha: 'a41c9e2b7d3', headline: 'Drop the seenEvents read', minutes: 3 * DAY - 25 },
] as const;

type Shape = {
  readonly pr: PullRequestState | null;
  readonly reviews: ReadonlyArray<PrReview>;
  readonly requests: ReadonlyArray<PrReviewRequest>;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly behind: number;
  readonly mergeable: boolean;
  readonly isMerged: boolean;
};

const BASE_PR: PullRequestState = {
  ...RESOLVE_SCENE_PR,
  url: PR_URL,
  body: PR_BODY,
  author: 'nadia-p',
  baseBranch: 'main',
  headBranch: MOUNT.branch,
  updatedAt: isoAgo({ minutes: 180 }),
};

const shapeOf = ({ variant }: { readonly variant: PrPageVariant }): Shape => {
  switch (variant) {
    case 'draft':
      return {
        pr: { ...BASE_PR, state: 'draft', isDraft: true, reviewDecision: null, checks: 'pending' },
        reviews: [],
        requests: [],
        checks: RUNNING,
        behind: 3,
        mergeable: true,
        isMerged: false,
      };
    case 'none':
      return {
        pr: null,
        reviews: [],
        requests: [],
        checks: [],
        behind: 0,
        mergeable: true,
        isMerged: false,
      };
    case 'merge-blocked':
      return {
        pr: {
          ...BASE_PR,
          state: 'approved',
          mergeable: true,
          reviewDecision: 'approved',
          checks: 'failure',
        },
        reviews: REVIEWS_APPROVED,
        requests: [],
        checks: TWO_FAILING,
        behind: 0,
        mergeable: true,
        isMerged: false,
      };
    case 'merge-methods':
      return {
        pr: {
          ...BASE_PR,
          state: 'approved',
          mergeable: true,
          reviewDecision: 'approved',
          checks: 'success',
        },
        reviews: REVIEWS_APPROVED,
        requests: [],
        checks: PASSING,
        behind: 0,
        mergeable: true,
        isMerged: false,
      };
    case 'merged':
      return {
        pr: {
          ...BASE_PR,
          state: 'merged',
          mergeable: true,
          reviewDecision: 'approved',
          checks: 'success',
          mergedAt: isoAgo({ minutes: 120 }),
        },
        reviews: REVIEWS_APPROVED,
        requests: [],
        checks: PASSING,
        behind: 0,
        mergeable: true,
        isMerged: true,
      };
    case 'github':
    case 'editing':
    case 'narrow':
      return {
        pr: { ...BASE_PR, reviewDecision: 'changes_requested', checks: 'failure' },
        reviews: REVIEWS_BLOCKING,
        requests: REQUEST_PRIYA,
        checks: FAILING,
        behind: 3,
        mergeable: true,
        isMerged: false,
      };
    default: {
      const unexpected: never = variant;
      return unexpected;
    }
  }
};

const viewOf = ({ shape }: { readonly shape: Shape }): PullRequestView | null => {
  const pr = shape.pr;
  if (pr === null) {
    return null;
  }
  return {
    host: 'github',
    number: pr.number,
    title: pr.title,
    body: pr.body,
    url: pr.url,
    state: pr.state,
    isDraft: pr.isDraft,
    author: { login: 'nadia-p', name: 'Nadia Petrova', avatarUrl: null },
    baseBranch: pr.baseBranch,
    headBranch: pr.headBranch,
    headSha: 'a41c9e2b7d3',
    createdAt: isoAgo({ minutes: 11 * DAY }),
    updatedAt: pr.updatedAt,
    mergedAt: pr.mergedAt ?? null,
    mergeable: pr.mergeable,
    reviewDecision: pr.reviewDecision,
    reviewers: [
      ...shape.reviews.map((review) => ({
        person: { login: review.author, name: null, avatarUrl: null },
        state: review.state,
      })),
      ...shape.requests.map((request) => ({
        person: { login: request.login, name: null, avatarUrl: null },
        state: 'pending' as const,
      })),
    ],
    resolves: [
      {
        label: '#412',
        url: 'https://github.com/harborline/payments-api/issues/412',
        isClosing: true,
      },
    ],
    checks: { read: 'ok', error: null, runs: shape.checks },
    files: { count: FILES.length, first: FILES },
    commits: COMMITS.map((commit) => ({
      sha: commit.sha,
      headline: commit.headline,
      committedAt: isoAgo({ minutes: commit.minutes }),
      author: 'nadia-p',
    })),
    mergeMethods: ['squash', 'rebase'],
    mergeMethodReasons: { merge: 'Turned off in payments-api' },
  };
};

const detailOf = ({
  shape,
  base,
}: {
  readonly shape: Shape;
  readonly base: PrDetail | null;
}): PrDetail | null => {
  const pr = shape.pr;
  if (pr === null) {
    return null;
  }
  return {
    prNumber: pr.number,
    comments: base?.comments ?? [],
    reviews: shape.reviews,
    reviewRequests: shape.requests,
    checks: shape.checks,
    checksRead: 'ok',
    checksError: null,
    reviewsRead: 'ok',
    reviewsError: null,
    reviewRequestsRead: 'ok',
    reviewRequestsError: null,
  };
};

const githubOf = ({
  pr,
  detail,
}: {
  readonly pr: PullRequestState | null;
  readonly detail: PrDetail | null;
}): MountGithubState => ({
  linkedIssues:
    pr === null
      ? []
      : [
          {
            number: 412,
            title: 'Duplicate credit on a retried webhook',
            url: 'https://github.com/harborline/payments-api/issues/412',
            closes: true,
          },
        ],
  fetchedAt: NOW_ISO,
  failedAt: null,
  loading: false,
  error: null,
  detail,
  detailFetchedAt: detail === null ? null : NOW_ISO,
  detailLoading: false,
  detailError: null,
  pr,
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  repository: 'harborline/payments-api',
  host: 'github.com',
  branch: MOUNT.branch,
  prs: pr === null ? [] : [pr],
  links: [],
});

const projectOf = (): Project => {
  const workspace = useAppStore.getState().workspaces[0];
  if (workspace === undefined) {
    throw new Error('the resolve seed has no workspace');
  }
  return {
    id: PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    name: 'payments-api',
    rootPath: '~/code/harborline/payments-api',
    kind: 'repo',
    baseBranch: 'main',
    overrides: workspace.overrides,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
};

const EMPTY_THREADS = JSON.stringify({
  data: {
    repository: {
      pullRequest: {
        reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
      },
    },
  },
});

const isGraphqlCall = ({ payload }: { readonly payload: unknown }): boolean =>
  typeof payload === 'object' &&
  payload !== null &&
  'args' in payload &&
  Array.isArray(payload.args) &&
  payload.args.includes('graphql');

const prPageStatus = ({ behind }: { readonly behind: number }): WorktreeStatus => ({
  ...CTX_STATUS,
  mainDistance: { kind: 'known', ahead: COMMITS.length, behind },
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
});

export const prPageHandlers = ({ behind }: { readonly behind: number }): FakeHandlers => ({
  ...handlersFor(BRANCH_FILES_PATCH),
  worktree_status: () => prPageStatus({ behind }),
});

const installIpc = ({ behind }: { readonly behind: number }): void => {
  const handlers = prPageHandlers({ behind });
  mockSceneIpc((command, payload) => {
    if (command === 'gh_run') {
      return {
        stdout: isGraphqlCall({ payload }) ? EMPTY_THREADS : '[]',
        stderr: '',
        exitCode: 0,
      };
    }
    return handlers[command]?.(undefined) ?? null;
  });
};

export const applyPrPageSeed = ({ variant }: { readonly variant: PrPageVariant }): void => {
  seedResolveScene({ expandedThreadId: null });
  const shape = shapeOf({ variant });
  const current = useAppStore.getState().sessionGithub[SESSION_ID];
  if (current === undefined) {
    throw new Error('the resolve seed has no pull request state');
  }
  const detail = detailOf({ shape, base: current.detail });
  const view = viewOf({ shape });
  const mountGithub = githubOf({ pr: shape.pr, detail });
  const noop = async (): Promise<void> => undefined;
  useAppStore.setState({
    projects: [projectOf()],
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    diffMountPath: { [SESSION_ID]: PR_PAGE_WORKTREE },
    branchTab: { [SESSION_ID]: 'pr' },
    sessionGithub: {
      [SESSION_ID]: {
        ...current,
        pr: shape.pr,
        detail,
        linkedIssues: mountGithub.linkedIssues,
        detailFetchedAt: detail === null ? null : NOW_ISO,
      },
    },
    mountGithub: { [MOUNT_ID]: mountGithub },
    pullRequestViews:
      view === null
        ? {}
        : {
            [SESSION_ID]: {
              prNumber: view.number,
              view,
              isLoading: false,
              error: null,
              fetchedAt: NOW_ISO,
              edits: [],
            },
          },
    sessionResolveQueueItems: { [SESSION_ID]: [] },
    sessionResolveAttempts: { [SESSION_ID]: [] },
    loadPullRequestView: noop,
    refreshSessionPr: noop,
    refreshSessionPrDetail: noop,
  });
  installIpc({ behind: shape.behind });
};
