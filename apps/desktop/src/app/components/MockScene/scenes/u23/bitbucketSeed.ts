import { bitbucketCheckRuns, bitbucketChecksOf, bitbucketReviewDecisionOf } from '@goodboy/core';
import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  PullRequestView,
  SessionMountView,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import type {
  BitbucketParticipant,
  BitbucketPullRequest,
  BitbucketStatus,
  BitbucketUser,
} from '../../../../../features/integrations/bitbucket/client';
import { useAppStore } from '../../../../../store';
import { applyMountBitbucketPr } from '../../../../../store/slices/bitbucket-pr/mountBitbucketPr';
import type { MountBitbucketPrState } from '../../../../../store/slices/bitbucket-pr/state';
import { handlersFor } from '../brand/DiffStage';
import { BRANCH_FILES_PATCH } from '../brand/contextDiffPatch';
import { CTX_STATUS } from '../brand/contextBranch';
import type { FakeHandlers } from '../brand/fakeTauri';
import { mockSceneIpc } from '../mockSceneIpc';
import { NOW_ISO, SESSION_ID, WORKSPACE_ID, isoAgo, seedResolveScene } from '../resolveSeed';

export type BitbucketPageVariant = 'pr' | 'merge' | 'denied' | 'checks' | 'none' | 'declined';

const PROJECT_ID = 'mock-u23-bb-project-payments-api' as ProjectId;
const MOUNT_ID = 'mock-u23-bb-mount-fix-duplicate-credit' as MountId;
export const BITBUCKET_PAGE_WORKTREE = '~/code/harborline/payments-api-fix-duplicate-credit';
const BRANCH = 'hl/fix-duplicate-credit';
const PR_URL = 'https://bitbucket.org/harborline/payments-api/pull-requests/42';
const DAY = 1440;

const PR_BODY = [
  'Retried webhooks posted a second credit because the guard keyed on the delivery id. A redelivery carries a new delivery id, so it slipped through.',
  '',
  '- Key the guard on the event id, stored as `idempotencyKey` on `LedgerPost`',
  '- `applyWebhook` answers 200 with `credited: false` for an event it has seen',
  '- Drop the `seenEvents` read from the hot path',
].join('\n');

const userOf = ({
  nickname,
  displayName,
}: {
  readonly nickname: string;
  readonly displayName: string;
}): BitbucketUser => ({
  uuid: `{${nickname}-uuid}`,
  accountId: null,
  nickname,
  displayName,
  avatarUrl: null,
});

const NADIA = userOf({ nickname: 'nadia-p', displayName: 'Nadia Petrova' });
const OMAR = userOf({ nickname: 'omar-t', displayName: 'Omar Tran' });
const KENJI = userOf({ nickname: 'kenji-w', displayName: 'Kenji Watanabe' });
const PRIYA = userOf({ nickname: 'priya-n', displayName: 'Priya Nair' });

const participantOf = ({
  user,
  approved = false,
  state = null,
}: {
  readonly user: BitbucketUser;
  readonly approved?: boolean;
  readonly state?: string | null;
}): BitbucketParticipant => ({ user, role: 'REVIEWER', approved, state });

const BLOCKING: ReadonlyArray<BitbucketParticipant> = [
  participantOf({ user: OMAR, state: 'changes_requested' }),
  participantOf({ user: KENJI, approved: true, state: 'approved' }),
  participantOf({ user: PRIYA }),
];

const APPROVED: ReadonlyArray<BitbucketParticipant> = [
  participantOf({ user: KENJI, approved: true, state: 'approved' }),
  participantOf({ user: OMAR, approved: true, state: 'approved' }),
];

const statusOf = ({
  key,
  state,
}: {
  readonly key: string;
  readonly state: BitbucketStatus['state'];
}): BitbucketStatus => ({
  key,
  name: key,
  state,
  url: `https://bitbucket.org/harborline/payments-api/pipelines/results/${encodeURIComponent(key)}`,
  description: null,
  refname: BRANCH,
  createdOn: isoAgo({ minutes: 70 }),
  updatedOn: isoAgo({ minutes: 62 }),
});

const FAILING: ReadonlyArray<BitbucketStatus> = [
  statusOf({ key: 'lint', state: 'FAILED' }),
  statusOf({ key: 'build', state: 'SUCCESSFUL' }),
  statusOf({ key: 'unit tests', state: 'SUCCESSFUL' }),
  statusOf({ key: 'contract tests', state: 'INPROGRESS' }),
];

const PASSING: ReadonlyArray<BitbucketStatus> = [
  statusOf({ key: 'lint', state: 'SUCCESSFUL' }),
  statusOf({ key: 'build', state: 'SUCCESSFUL' }),
  statusOf({ key: 'unit tests', state: 'SUCCESSFUL' }),
  statusOf({ key: 'contract tests', state: 'SUCCESSFUL' }),
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
  { sha: '3e7c5a90b21', headline: 'Add the retry test', minutes: 3 * DAY },
  { sha: 'a41c9e2b7d3', headline: 'Drop the seenEvents read', minutes: 3 * DAY - 25 },
] as const;

type Shape = {
  readonly state: BitbucketPullRequest['state'] | null;
  readonly participants: ReadonlyArray<BitbucketParticipant>;
  readonly statuses: ReadonlyArray<BitbucketStatus>;
  readonly read: 'ok' | 'denied';
};

const shapeOf = ({ variant }: { readonly variant: BitbucketPageVariant }): Shape => {
  switch (variant) {
    case 'none':
      return { state: null, participants: [], statuses: [], read: 'ok' };
    case 'merge':
      return { state: 'OPEN', participants: APPROVED, statuses: PASSING, read: 'ok' };
    case 'declined':
      return { state: 'DECLINED', participants: BLOCKING, statuses: FAILING, read: 'ok' };
    case 'denied':
      return { state: 'OPEN', participants: BLOCKING, statuses: [], read: 'denied' };
    case 'pr':
    case 'checks':
      return { state: 'OPEN', participants: BLOCKING, statuses: FAILING, read: 'ok' };
    default: {
      const unexpected: never = variant;
      return unexpected;
    }
  }
};

const pullRequestOf = ({
  shape,
  state,
}: {
  readonly shape: Shape;
  readonly state: BitbucketPullRequest['state'];
}): BitbucketPullRequest => ({
  id: 42,
  title: 'Stop retried webhooks posting a second credit',
  description: PR_BODY,
  state,
  createdOn: isoAgo({ minutes: 11 * DAY }),
  updatedOn: isoAgo({ minutes: 180 }),
  sourceBranch: BRANCH,
  sourceCommit: 'a41c9e2b7d3',
  destinationBranch: 'main',
  destinationCommit: null,
  author: NADIA,
  reviewers: shape.participants.flatMap((participant) =>
    participant.user === null ? [] : [participant.user],
  ),
  participants: shape.participants,
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: PR_URL,
});

const viewOf = ({
  shape,
  pr,
}: {
  readonly shape: Shape;
  readonly pr: BitbucketPullRequest;
}): PullRequestView => ({
  host: 'bitbucket',
  number: pr.id,
  title: pr.title,
  body: pr.description,
  url: PR_URL,
  state: pr.state === 'OPEN' ? 'open' : 'closed',
  isDraft: false,
  author: { login: 'nadia-p', name: 'Nadia Petrova', avatarUrl: null },
  baseBranch: pr.destinationBranch,
  headBranch: pr.sourceBranch,
  headSha: pr.sourceCommit,
  createdAt: pr.createdOn,
  updatedAt: pr.updatedOn,
  mergedAt: null,
  mergeable: null,
  reviewDecision: bitbucketReviewDecisionOf({ participants: pr.participants }),
  reviewers: pr.participants.flatMap((participant) =>
    participant.user === null
      ? []
      : [
          {
            person: {
              login: participant.user.nickname,
              name: participant.user.displayName,
              avatarUrl: null,
            },
            state:
              participant.state === 'changes_requested'
                ? ('changes_requested' as const)
                : participant.approved
                  ? ('approved' as const)
                  : ('pending' as const),
          },
        ],
  ),
  resolves: [],
  checks:
    shape.read === 'denied'
      ? { read: 'denied', error: 'The API token lacks the pull request scope', runs: [] }
      : { read: 'ok', error: null, runs: bitbucketCheckRuns({ statuses: shape.statuses }) },
  files: { count: FILES.length, first: FILES },
  commits: COMMITS.map((commit) => ({
    sha: commit.sha,
    headline: commit.headline,
    committedAt: isoAgo({ minutes: commit.minutes }),
    author: 'nadia-p',
  })),
  mergeMethods: ['squash', 'merge', 'rebase'],
  mergeMethodReasons: {},
});

const PROJECT_MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: BITBUCKET_PAGE_WORKTREE,
  lastWorktreePath: null,
  repoRoot: '~/code/harborline/payments-api',
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const MOUNT_VIEW: SessionMountView = {
  id: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  worktreePath: BITBUCKET_PAGE_WORKTREE,
  lastWorktreePath: null,
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'payments-api',
  repoSlug: 'harborline/payments-api',
  repoRoot: '~/code/harborline/payments-api',
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: NOW_ISO as IsoDateTime,
  updatedAt: NOW_ISO as IsoDateTime,
};

const BINDING: IntegrationBinding = {
  id: 'mock-u23-bb-binding' as IntegrationBindingId,
  workspaceId: WORKSPACE_ID,
  projectId: null,
  credentialId: 'mock-u23-bb-credential' as IntegrationCredentialId,
  createdAt: NOW_ISO as IsoDateTime,
  updatedAt: NOW_ISO as IsoDateTime,
  provider: 'bitbucket',
  config: { workspaceSlug: 'harborline', email: 'nadia@harborline.test' },
};

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

const prPageStatus = () => ({
  ...CTX_STATUS,
  mainDistance: { kind: 'known' as const, ahead: COMMITS.length, behind: 0 },
  upstreamDistance: { kind: 'known' as const, ahead: 0, behind: 0 },
});

export const bitbucketPageHandlers = (): FakeHandlers => ({
  ...handlersFor(BRANCH_FILES_PATCH),
  worktree_status: () => prPageStatus(),
  worktree_remote_url: () => 'git@bitbucket.org:harborline/payments-api.git',
});

const installIpc = (): void => {
  const handlers = bitbucketPageHandlers();
  mockSceneIpc((command) => handlers[command]?.(undefined) ?? null);
};

const entryOf = ({
  shape,
  pr,
}: {
  readonly shape: Shape;
  readonly pr: BitbucketPullRequest | null;
}): MountBitbucketPrState => ({
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  host: pr === null ? null : 'bitbucket.org',
  repo: {
    workspaceId: WORKSPACE_ID as WorkspaceId,
    workspaceSlug: 'harborline',
    repoSlug: 'payments-api',
    email: 'nadia@harborline.test',
  },
  repository: 'harborline/payments-api',
  branch: BRANCH,
  prs: pr === null ? [] : [pr],
  links: [],
  checks:
    pr === null || pr.state !== 'OPEN' ? null : bitbucketChecksOf({ statuses: shape.statuses }),
  reviewDecision:
    pr === null || pr.state !== 'OPEN'
      ? null
      : bitbucketReviewDecisionOf({ participants: pr.participants }),
  pr,
  fetchedAt: NOW_ISO as IsoDateTime,
  loading: false,
  error: null,
});

export const applyBitbucketPageSeed = ({
  variant,
}: {
  readonly variant: BitbucketPageVariant;
}): void => {
  seedResolveScene({ expandedThreadId: null });
  const shape = shapeOf({ variant });
  const pr = shape.state === null ? null : pullRequestOf({ shape, state: shape.state });
  const view = pr === null ? null : viewOf({ shape, pr });
  const entry = entryOf({ shape, pr });
  const base = useAppStore.getState();
  const current = base.sessionGithub[SESSION_ID];
  if (current === undefined) {
    throw new Error('the resolve seed has no pull request state');
  }
  const noop = async (): Promise<void> => undefined;
  const projected = applyMountBitbucketPr({
    state: {
      ...base,
      sessionMounts: { [SESSION_ID]: [MOUNT_VIEW] },
      sessionProjectMounts: { [SESSION_ID]: [PROJECT_MOUNT] },
      sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
      sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    },
    sessionId: SESSION_ID,
    mountId: MOUNT_ID,
    bitbucket: entry,
  });
  useAppStore.setState({
    ...projected,
    projects: [projectOf()],
    workspaceIntegrations: { [WORKSPACE_ID]: [BINDING] },
    sessionMounts: { [SESSION_ID]: [MOUNT_VIEW] },
    sessionProjectMounts: { [SESSION_ID]: [PROJECT_MOUNT] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    diffMountPath: { [SESSION_ID]: BITBUCKET_PAGE_WORKTREE },
    branchTab: { [SESSION_ID]: variant === 'checks' || variant === 'denied' ? 'checks' : 'pr' },
    sessionGithub: {
      [SESSION_ID]: { ...current, pr: null, detail: null, linkedIssues: [], detailFetchedAt: null },
    },
    mountGithub: {},
    reviewSourceKeys: { [SESSION_ID]: null },
    reviewSourceThreads: {},
    pullRequestViews:
      view === null
        ? {}
        : {
            [SESSION_ID]: {
              prNumber: view.number,
              mountId: MOUNT_ID,
              view,
              isLoading: false,
              error: null,
              fetchedAt: NOW_ISO as IsoDateTime,
              edits: [],
            },
          },
    sessionResolveQueueItems: { [SESSION_ID]: [] },
    sessionResolveAttempts: { [SESSION_ID]: [] },
    sessionResolveThreads: { [SESSION_ID]: [] },
    loadPullRequestView: noop,
    refreshSessionPr: noop,
    refreshSessionPrDetail: noop,
    refreshSessionBitbucketPr: noop,
  });
  installIpc();
};
