import { mockIPC } from '@tauri-apps/api/mocks';
import type {
  AgentId,
  MountId,
  PrCheckRun,
  Project,
  ProjectId,
  PullRequestState,
  SessionMountView,
  SessionProjectMount,
  WorktreeStatus,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import type { LensKind } from '../../../../store';
import { CTX_COMMITS } from './brand/contextBranch';
import { CTX_PATCH } from './brand/contextDiffPatch';
import { SESSION, SESSION_ID, seedResolveScene } from './resolveSeed';
import { seedShellChrome } from './shellChrome';
import { sceneClock } from '../sceneClock';

export const CODE_LAYERS = ['overview', 'pr', 'diff', 'review'] as const;

export type CodeLayer = (typeof CODE_LAYERS)[number];

export const PR_SCENE_STATES = [
  'draft',
  'failing',
  'ready',
  'conflicts',
  'merged',
  'closed',
  'other',
] as const;

export type PrSceneState = (typeof PR_SCENE_STATES)[number];

export const WORKTREE_SCENE_STATES = [
  'open',
  'behind',
  'dirty',
  'unpushed',
  'diverged',
  'rebase',
  'nopr',
  'merged',
] as const;

export type WorktreeSceneState = (typeof WORKTREE_SCENE_STATES)[number];

const clock = sceneClock({ anchor: '2026-09-04T14:20:00.000Z' });
const NOW = clock.iso({ at: '2026-09-04T14:20:00.000Z' });
const PROJECT_ID = 'mock-code-layers-project-payments-api' as ProjectId;
const MOUNT_ID = 'mock-code-layers-mount-payments-api' as MountId;
const WORKTREE = '~/code/harborline/payments-api-backfill';
const BRANCH = 'hl/fix-duplicate-credit';

const PROJECT: Project = {
  id: PROJECT_ID,
  workspaceId: SESSION.workspaceId,
  name: 'payments-api',
  rootPath: '~/code/harborline/payments-api',
  kind: 'repo',
  baseBranch: 'main',
  overrides: {
    defaultProviderId: null,
    defaultBranchPrefix: null,
    defaultVerbosity: null,
    providerBindings: null,
    taskModels: null,
    roleModels: null,
    parallelAgents: null,
    providerPool: null,
    attributionFooter: null,
    replyVoice: null,
    replyStyleNote: null,
    replyTemplateFixed: null,
    replyTemplateNoChange: null,
    resolveOnGithub: null,
    resolveCommitStyle: null,
    afterMerge: null,
  },
  createdAt: NOW,
  updatedAt: NOW,
};

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: WORKTREE,
  lastWorktreePath: null,
  repoRoot: '~/code/harborline/payments-api',
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 2,
};

const CHECKS: Readonly<Record<'green' | 'failing', ReadonlyArray<PrCheckRun>>> = {
  green: [
    { name: 'typecheck', conclusion: 'success', detailsUrl: null, durationMs: 84_000 },
    { name: 'unit tests', conclusion: 'success', detailsUrl: null, durationMs: 212_000 },
    { name: 'lint', conclusion: 'success', detailsUrl: null, durationMs: 41_000 },
  ],
  failing: [
    { name: 'typecheck', conclusion: 'success', detailsUrl: null, durationMs: 84_000 },
    { name: 'unit tests', conclusion: 'failure', detailsUrl: null, durationMs: 212_000 },
    { name: 'lint', conclusion: 'success', detailsUrl: null, durationMs: 41_000 },
  ],
};

const prFor = ({
  base,
  state,
}: {
  readonly base: PullRequestState;
  readonly state: PrSceneState;
}): PullRequestState => {
  switch (state) {
    case 'draft':
      return { ...base, isDraft: true, checks: 'success', reviewDecision: null };
    case 'failing':
      return { ...base, checks: 'failure', reviewDecision: 'changes_requested' };
    case 'ready':
      return { ...base, checks: 'success', reviewDecision: 'approved', mergeable: true };
    case 'conflicts':
      return { ...base, checks: 'success', reviewDecision: 'approved', mergeable: false };
    case 'merged':
      return { ...base, state: 'merged', checks: 'success', reviewDecision: 'approved' };
    case 'closed':
      return { ...base, state: 'closed', checks: 'success', reviewDecision: null };
    case 'other':
      return { ...base, author: 'kenji-w', checks: 'success', reviewDecision: 'review_required' };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

const statusFor = ({ state }: { readonly state: WorktreeSceneState }): WorktreeStatus => {
  const base: WorktreeStatus = {
    branch: BRANCH,
    head: CTX_COMMITS[0]?.sha ?? null,
    headSubject: CTX_COMMITS[0]?.subject ?? null,
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    mainDistance: { kind: 'known', ahead: 5, behind: 0 },
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
    upstream: `origin/${BRANCH}`,
    inProgress: null,
  };
  const dirty = {
    kind: 'known',
    staged: 0,
    unstaged: 2,
    untracked: 0,
    unmerged: 0,
    changed: 2,
  } as const;
  switch (state) {
    case 'open':
    case 'merged':
      return state === 'merged'
        ? { ...base, mainDistance: { kind: 'known', ahead: 0, behind: 0 } }
        : base;
    case 'behind':
      return { ...base, mainDistance: { kind: 'known', ahead: 5, behind: 4 } };
    case 'dirty':
      return { ...base, mainDistance: { kind: 'known', ahead: 5, behind: 4 }, workingTree: dirty };
    case 'unpushed':
      return { ...base, upstreamDistance: { kind: 'known', ahead: 2, behind: 0 } };
    case 'diverged':
      return { ...base, upstreamDistance: { kind: 'known', ahead: 1, behind: 1 } };
    case 'rebase':
      return {
        ...base,
        inProgress: 'rebase',
        workingTree: {
          kind: 'known',
          staged: 0,
          unstaged: 1,
          untracked: 0,
          unmerged: 2,
          changed: 3,
        },
      };
    case 'nopr':
      return {
        ...base,
        upstream: null,
        upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
        mainDistance: { kind: 'known', ahead: 3, behind: 0 },
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

const installGitIpc = ({ status }: { readonly status: WorktreeStatus }): void => {
  mockIPC((cmd) => {
    if (cmd === 'worktree_status') {
      return status;
    }
    if (cmd === 'worktree_diff' || cmd === 'worktree_diff_range') {
      return CTX_PATCH;
    }
    if (cmd === 'worktree_commits') {
      return CTX_COMMITS;
    }
    if (cmd === 'history_backups_list' || cmd === 'db_select') {
      return [];
    }
    return null;
  });
};

const LENS: Readonly<Record<CodeLayer, LensKind | null>> = {
  overview: null,
  pr: 'pr',
  diff: 'files',
  review: 'review',
};

type SeedParams = {
  readonly layer: CodeLayer;
  readonly prState: PrSceneState;
  readonly worktreeState: WorktreeSceneState;
};

export const seedCodeLayers = ({ layer, prState, worktreeState }: SeedParams): void => {
  seedResolveScene({ expandedThreadId: null });
  seedShellChrome({
    session: SESSION,
    siblings: [],
    branches: { [SESSION_ID]: BRANCH },
    telemetryAt: NOW,
    lens: LENS[layer],
  });
  const status = statusFor({ state: worktreeState });
  installGitIpc({ status });
  const github = useAppStore.getState().sessionGithub[SESSION_ID];
  if (github === undefined || github.pr === null) {
    return;
  }
  const hasPr = worktreeState !== 'nopr';
  const pr = prFor({
    base: { ...github.pr, author: 'mara-l' },
    state: worktreeState === 'merged' ? 'merged' : prState,
  });
  const detail =
    github.detail === null
      ? null
      : { ...github.detail, checks: [...CHECKS[prState === 'failing' ? 'failing' : 'green']] };
  const view: SessionMountView = {
    id: MOUNT_ID,
    sessionId: SESSION_ID,
    projectId: PROJECT_ID,
    worktreePath: WORKTREE,
    lastWorktreePath: WORKTREE,
    branch: BRANCH,
    baseBranch: 'main',
    parallelIndex: 0,
    mountName: 'payments-api',
    repoSlug: 'harborline/payments-api',
    repoRoot: MOUNT.repoRoot,
    isAttached: true,
    diskState: 'present',
    revision: 2,
    createdAt: NOW,
    updatedAt: NOW,
  };
  useAppStore.setState({
    projects: [PROJECT],
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    sessionMounts: { [SESSION_ID]: [view] },
    sessionPhaseRuns: {
      [SESSION_ID]: [
        {
          id: 'mock-code-layers-agent-implementer' as AgentId,
          sessionId: SESSION_ID,
          ordinal: 1,
          name: 'Implementer',
          status: 'completed',
        },
      ],
    },
    loadSessionMounts: async () => [view],
    loadPrSeries: async () => [],
    sessionWorktreeRecords: {
      [SESSION_ID]: [
        {
          id: 'mock-code-layers-worktree-payments-api',
          sessionId: SESSION_ID,
          worktreePath: WORKTREE,
          branch: BRANCH,
          parallelIndex: 0,
          projectId: PROJECT_ID,
          mountName: 'payments-api',
          repoSlug: 'harborline/payments-api',
          createdAt: Date.parse(NOW),
        },
      ],
    },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    githubStatus: { mode: 'gh-cli', available: true, user: 'mara-l' },
    reviewDrafts: { [SESSION_ID]: [] },
    reviewTargets: { [SESSION_ID]: null },
    diffComments: { [SESSION_ID]: [] },
    detectedEditors: [{ binary: 'code', label: 'VS Code' }],
    loadDetectedEditors: async () => undefined,
    loadReviewDrafts: async () => undefined,
    refreshSessionPr: async () => undefined,
    refreshSessionPrDetail: async () => undefined,
    selectSessionPr: async () => undefined,
    sessionGithub: {
      [SESSION_ID]: { ...github, pr: hasPr ? pr : null, detail: hasPr ? detail : null },
    },
    sessionProjectPrs: { [SESSION_ID]: { [PROJECT_ID]: hasPr ? [pr] : [] } },
    mountGithub: hasPr
      ? {
          [MOUNT_ID]: {
            ...github,
            pr,
            detail,
            prs: [pr],
            mountId: MOUNT_ID,
            projectId: PROJECT_ID,
            revision: 2,
            repository: 'harborline/payments-api',
            host: 'github.com',
            branch: BRANCH,
            links: [],
          },
        }
      : {},
    mountGitlabMr: {},
    mountBitbucketPr: {},
  });
  useAppStore
    .getState()
    .navigate({ to: sessionPlace({ sessionId: SESSION_ID, lens: LENS[layer] }) });
};
