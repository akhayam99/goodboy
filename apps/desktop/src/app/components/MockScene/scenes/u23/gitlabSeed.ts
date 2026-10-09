import { gitlabPullRequestPort, type GitlabPullRequestTransport } from '@goodboy/core';
import type {
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  PullRequestView,
  SessionProjectMount,
} from '@goodboy/types';
import type {
  GitlabJob,
  GitlabMergeRequest,
  GitlabMergeSettings,
  GitlabMrApprovalState,
  GitlabMrChecks,
  GitlabMrCommit,
} from '../../../../../features/integrations/gitlab/client';
import { useAppStore } from '../../../../../store';
import type { MountGitlabMrState } from '../../../../../store/slices/gitlab-mr/state';
import { mockSceneIpc } from '../mockSceneIpc';
import { NOW_ISO, SESSION_ID, WORKSPACE_ID, isoAgo, seedResolveScene } from '../resolveSeed';
import { prPageHandlers } from './prPageSeed';

export type GitlabPageVariant = 'open' | 'merge' | 'denied' | 'jobs' | 'none';

const PROJECT_ID = 'mock-u23-gitlab-project-payments-api' as ProjectId;
const MOUNT_ID = 'mock-u23-gitlab-mount-fix-duplicate-credit' as MountId;
export const GITLAB_PAGE_WORKTREE = '~/code/harborline/payments-api-fix-duplicate-credit';
const HOST = 'https://gitlab.com';
const PROJECT_PATH = 'harborline/payments-api';
const MR_URL = `${HOST}/${PROJECT_PATH}/-/merge_requests/42`;
const DAY = 1440;

const MR_BODY = [
  'Retried webhooks posted a second credit because the guard keyed on the delivery id. A redelivery carries a new delivery id, so it slipped through.',
  '',
  '- Key the guard on the event id, stored as `idempotencyKey` on `LedgerPost`',
  '- `applyWebhook` answers 200 with `credited: false` for an event it has seen',
  '- Drop the `seenEvents` read from the hot path',
].join('\n');

const NADIA = { id: 3, username: 'nadia-p', name: 'Nadia Petrova', avatarUrl: null };
const OMAR = { id: 4, username: 'omar-t', name: 'Omar Tan', avatarUrl: null };
const KENJI = { id: 7, username: 'kenji-w', name: 'Kenji Watanabe', avatarUrl: null };
const PRIYA = { id: 8, username: 'priya-n', name: 'Priya Nair', avatarUrl: null };
const MARA = { id: 9, username: 'mara-q', name: 'Mara Quinn', avatarUrl: null };

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: GITLAB_PAGE_WORKTREE,
  lastWorktreePath: null,
  repoRoot: '~/code/harborline/payments-api',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const job = ({
  id,
  name,
  status,
  duration = 60,
  allowFailure = false,
}: {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly duration?: number | null;
  readonly allowFailure?: boolean;
}): GitlabJob => ({
  id,
  name,
  stage: 'test',
  status,
  webUrl: `${HOST}/${PROJECT_PATH}/-/jobs/${id}`,
  allowFailure,
  duration,
});

const FAILING_JOBS: ReadonlyArray<GitlabJob> = [
  job({ id: 78, name: 'lint', status: 'failed', duration: 12 }),
  job({ id: 77, name: 'unit tests', status: 'success', duration: 83.5 }),
  job({ id: 79, name: 'contract tests', status: 'success', duration: 141 }),
  job({ id: 80, name: 'integration tests', status: 'running', duration: null }),
  job({ id: 81, name: 'deploy preview', status: 'manual', duration: null, allowFailure: true }),
];

const PASSING_JOBS: ReadonlyArray<GitlabJob> = [
  job({ id: 77, name: 'unit tests', status: 'success', duration: 83.5 }),
  job({ id: 78, name: 'lint', status: 'success', duration: 12 }),
  job({ id: 79, name: 'contract tests', status: 'success', duration: 141 }),
  job({ id: 80, name: 'integration tests', status: 'success', duration: 212 }),
  job({ id: 81, name: 'deploy preview', status: 'manual', duration: null, allowFailure: true }),
];

const COMMITS: ReadonlyArray<GitlabMrCommit> = [
  {
    id: 'a41c9e2b7d3f',
    shortId: 'a41c9e2b',
    title: 'Drop the seenEvents read',
    authorName: 'Nadia Petrova',
    committedDate: isoAgo({ minutes: 3 * DAY }),
  },
  {
    id: '9f13a7be2c5d',
    shortId: '9f13a7be',
    title: 'Answer 200 for a seen event',
    authorName: 'Nadia Petrova',
    committedDate: isoAgo({ minutes: 11 * DAY - 90 }),
  },
  {
    id: '6c20f48a9e1c',
    shortId: '6c20f48a',
    title: 'Key the credit guard on the event id',
    authorName: 'Nadia Petrova',
    committedDate: isoAgo({ minutes: 11 * DAY }),
  },
];

const FILE_PATHS = [
  'src/ledger/ledgerClient.ts',
  'src/ledger/postCredit.ts',
  'src/webhooks/applyWebhook.ts',
  'src/webhooks/seenEvents.ts',
  'test/applyWebhook.test.ts',
];

const CHANGES = FILE_PATHS.map(
  (path) =>
    `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,2 +1,3 @@\n keep\n-old\n+new\n+more\n`,
).join('');

const SETTINGS: GitlabMergeSettings = {
  mergeMethod: 'merge',
  squashOption: 'never',
  onlyAllowMergeIfPipelineSucceeds: false,
};

const approvalsOf = ({ left }: { readonly left: number }): GitlabMrApprovalState => ({
  approvalsRequired: 2,
  approvalsLeft: left,
  userHasApproved: false,
  userCanApprove: true,
  approvedBy: left === 0 ? [{ user: KENJI }, { user: OMAR }] : [{ user: KENJI }],
});

const mergeRequestOf = ({
  variant,
}: {
  readonly variant: GitlabPageVariant;
}): GitlabMergeRequest => ({
  id: 4201,
  iid: 42,
  projectId: 9,
  title: 'Stop retried webhooks posting a second credit',
  description: MR_BODY,
  state: 'opened',
  webUrl: MR_URL,
  sourceBranch: MOUNT.branch,
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  detailedMergeStatus: 'mergeable',
  updatedAt: isoAgo({ minutes: 180 }),
  createdAt: isoAgo({ minutes: 11 * DAY }),
  sha: 'a41c9e2b7d3f',
  mergedAt: null,
  author: NADIA,
  reviewers: variant === 'merge' ? [OMAR, KENJI] : [OMAR, KENJI, PRIYA],
  headPipeline: {
    id: 9001,
    status: variant === 'merge' ? 'success' : 'failed',
    webUrl: `${HOST}/${PROJECT_PATH}/-/pipelines/9001`,
  },
});

type Seed = {
  readonly mr: GitlabMergeRequest | null;
  readonly approvals: GitlabMrApprovalState | null;
  readonly checks: GitlabMrChecks | null;
};

const seedOf = ({ variant }: { readonly variant: GitlabPageVariant }): Seed => {
  if (variant === 'none') {
    return { mr: null, approvals: null, checks: null };
  }
  const mr = mergeRequestOf({ variant });
  if (variant === 'merge') {
    return {
      mr,
      approvals: approvalsOf({ left: 0 }),
      checks: { pipeline: null, jobs: PASSING_JOBS },
    };
  }
  return {
    mr,
    approvals: approvalsOf({ left: 1 }),
    checks: variant === 'denied' ? null : { pipeline: null, jobs: FAILING_JOBS },
  };
};

const DENIED_LINE = 'http error 403: {"message":"403 Forbidden"}';

const transportOf = ({ seed }: { readonly seed: Seed }): GitlabPullRequestTransport => ({
  readMergeRequest: async () => {
    if (seed.mr === null) {
      throw new Error('no merge request');
    }
    return seed.mr;
  },
  readCommits: async () => COMMITS,
  readChanges: async () => CHANGES,
  readApprovals: async () => seed.approvals,
  readPipelineJobs: async () => seed.checks,
  updateMergeRequest: async () => undefined,
  setState: async () => undefined,
  merge: async () => undefined,
  projectMergeSettings: async () => SETTINGS,
  searchUsers: async () => [KENJI, PRIYA, OMAR],
});

const viewOf = async ({
  variant,
  seed,
}: {
  readonly variant: GitlabPageVariant;
  readonly seed: Seed;
}): Promise<PullRequestView | null> =>
  variant === 'none' || variant === 'denied'
    ? null
    : gitlabPullRequestPort({ transport: transportOf({ seed }), mrUrl: MR_URL }).read();

const writes: Array<{ readonly command: string; readonly payload: unknown }> = [];

export const gitlabSceneWrites = (): ReadonlyArray<{
  readonly command: string;
  readonly payload: unknown;
}> => writes;

export const clearGitlabSceneWrites = (): void => {
  writes.length = 0;
};

const installIpc = ({
  variant,
  seed,
}: {
  readonly variant: GitlabPageVariant;
  readonly seed: Seed;
}): void => {
  const base = prPageHandlers({ behind: variant === 'merge' ? 0 : 3 });
  mockSceneIpc((command, payload) => {
    if (command.startsWith('gitlab_')) {
      writes.push({ command, payload });
      return command === 'gitlab_search_project_users' ? [KENJI, PRIYA, OMAR, MARA] : seed.mr;
    }
    switch (command) {
      case 'worktree_remote_url':
        return 'git@gitlab.com:harborline/payments-api.git';
      case 'gh_run':
        return { stdout: '[]', stderr: '', exitCode: 0 };
      default:
        return base[command]?.(undefined) ?? null;
    }
  });
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

const mountEntryOf = ({ seed }: { readonly seed: Seed }): MountGitlabMrState => ({
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  host: HOST,
  projectPath: PROJECT_PATH,
  branch: MOUNT.branch,
  mrs: seed.mr === null ? [] : [seed.mr],
  links: [],
  mr: seed.mr,
  approvals: seed.approvals,
  fetchedAt: NOW_ISO as IsoDateTime,
  loading: false,
  error: null,
});

export const applyGitlabSeed = async ({
  variant,
}: {
  readonly variant: GitlabPageVariant;
}): Promise<void> => {
  seedResolveScene({ expandedThreadId: null });
  const seed = seedOf({ variant });
  const entry = mountEntryOf({ seed });
  const view = await viewOf({ variant, seed });
  const noop = async (): Promise<void> => undefined;
  useAppStore.setState({
    projects: [projectOf()],
    workspaceIntegrations: {
      [WORKSPACE_ID]: [
        {
          id: 'mock-u23-gitlab-binding' as IntegrationBindingId,
          workspaceId: WORKSPACE_ID,
          projectId: null,
          credentialId: 'mock-u23-gitlab-credential' as IntegrationCredentialId,
          createdAt: NOW_ISO as IsoDateTime,
          updatedAt: NOW_ISO as IsoDateTime,
          provider: 'gitlab',
          config: { userName: 'nadia-p', userId: '3', host: HOST },
        },
      ],
    },
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    diffMountPath: { [SESSION_ID]: GITLAB_PAGE_WORKTREE },
    branchTab: { [SESSION_ID]: variant === 'jobs' ? 'checks' : 'pr' },
    sessionGithub: {},
    mountGithub: {},
    mountGitlabMr: { [MOUNT_ID]: entry },
    sessionGitlabMr: {
      [SESSION_ID]: {
        mr: seed.mr,
        approvals: seed.approvals,
        fetchedAt: NOW_ISO as IsoDateTime,
        loading: false,
        error: null,
      },
    },
    reviewSourceKeys: { [SESSION_ID]: null },
    reviewSourceThreads: {},
    pullRequestViews:
      seed.mr === null
        ? {}
        : {
            [SESSION_ID]: {
              prNumber: seed.mr.iid,
              mountId: MOUNT_ID,
              view,
              isLoading: false,
              error: view === null ? DENIED_LINE : null,
              errorKind: view === null ? ('denied' as const) : null,
              fetchedAt: NOW_ISO as IsoDateTime,
              edits: [],
            },
          },
    sessionResolveQueueItems: { [SESSION_ID]: [] },
    sessionResolveAttempts: { [SESSION_ID]: [] },
    refreshSessionPr: noop,
    refreshSessionPrDetail: noop,
    refreshSessionMr: noop,
    loadPullRequestView: noop,
  });
  installIpc({ variant, seed });
};
