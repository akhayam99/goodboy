import {
  brandId,
  type Agent,
  type AgentId,
  type AgentRole,
  type EffortLevel,
  type IsoDateTime,
  type MeasuredTurnSpan,
  type MountId,
  type PrCheckRun,
  type Project,
  type ProjectId,
  type ProviderId,
  type ProviderRunId,
  type PullRequestState,
  type Session,
  type SessionExternalTask,
  type SessionId,
  type SessionProjectMount,
  type WorktreeStatus,
} from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import type { AgentKind } from '../../../../../features/session/agent-kind';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../activityRunSeed';
import { CTX_STATUS } from '../brand/contextBranch';
import { seedBrandLimits } from '../brand/limitsSeed';
import { mockSceneIpc } from '../mockSceneIpc';
import { seedShellChrome } from '../shellChrome';
import { HERO_DIFF_PATCH, HERO_SHARED_PATH } from './heroDiffPatch';

export const HERO_SESSION_ID = SESSION_ID;

const clock = sceneClock({ anchor: '2026-11-05T15:58:00.000Z' });

type AtParams = {
  readonly time: string;
};

const at = ({ time }: AtParams): IsoDateTime => clock.iso({ at: `2026-11-05T${time}:00.000Z` });

const ms = ({ time }: AtParams): number => clock.ms({ at: `2026-11-05T${time}:00.000Z` });

const GOAL_LINE =
  'Key every credit on the processor event id so a retried webhook never posts twice, even when Northwind resends the same event with a new payload. Show support a stuck delivery in notify-relay with its last three attempts. Keep ledger-core read only: the fix changes how credits are keyed, never the ledger itself.';

const API_PROJECT_ID = brandId<ProjectId>({ value: 'mock-hero-project-payments-api' });
const RELAY_PROJECT_ID = brandId<ProjectId>({ value: 'mock-hero-project-notify-relay' });

const API_MOUNT_ID = brandId<MountId>({ value: 'mock-hero-mount-payments-api' });
const REPLAY_MOUNT_ID = brandId<MountId>({ value: 'mock-hero-mount-payments-api-replay' });
const RELAY_MOUNT_ID = brandId<MountId>({ value: 'mock-hero-mount-notify-relay' });

const API_BRANCH = 'hl/fix-duplicate-credit';
const REPLAY_BRANCH = 'hl/dedupe-load-test';
const RELAY_BRANCH = 'hl/surface-retry-state';

const API_PATH = '/w/harborline/payments-api';

const EXPORT_SESSION_ID = brandId<SessionId>({ value: 'mock-hero-session-payout-export' });
const EXPORT_MOUNT_ID = brandId<MountId>({ value: 'mock-hero-mount-payout-export' });
const EXPORT_KEY = 'HBL-415';

type MountParams = {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly branch: string;
  readonly path: string;
  readonly parallelIndex: number;
};

const mountOf = ({
  mountId,
  projectId,
  name,
  branch,
  path,
  parallelIndex,
}: MountParams): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId,
  mountName: name,
  worktreePath: path,
  lastWorktreePath: null,
  repoRoot: `/w/harborline/${name}`,
  branch,
  baseBranch: 'main',
  parallelIndex,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const MOUNTS: ReadonlyArray<SessionProjectMount> = [
  mountOf({
    mountId: API_MOUNT_ID,
    projectId: API_PROJECT_ID,
    name: 'payments-api',
    branch: API_BRANCH,
    path: API_PATH,
    parallelIndex: 0,
  }),
  mountOf({
    mountId: REPLAY_MOUNT_ID,
    projectId: API_PROJECT_ID,
    name: 'payments-api',
    branch: REPLAY_BRANCH,
    path: '/w/harborline/replay/payments-api',
    parallelIndex: 1,
  }),
  mountOf({
    mountId: RELAY_MOUNT_ID,
    projectId: RELAY_PROJECT_ID,
    name: 'notify-relay',
    branch: RELAY_BRANCH,
    path: '/w/harborline/notify-relay',
    parallelIndex: 0,
  }),
];

const DIFF_STATS: Readonly<Record<string, Readonly<{ additions: number; deletions: number }>>> = {
  [API_PATH]: { additions: 142, deletions: 38 },
  '/w/harborline/replay/payments-api': { additions: 64, deletions: 9 },
  '/w/harborline/notify-relay': { additions: 86, deletions: 12 },
};

type PayloadParams = {
  readonly payload: unknown;
};

const mountOfPayload = ({ payload }: PayloadParams): SessionProjectMount | null => {
  const text = JSON.stringify(payload ?? {});
  return (
    [...MOUNTS]
      .sort((left, right) => right.worktreePath.length - left.worktreePath.length)
      .find((mount) => text.includes(mount.worktreePath)) ?? null
  );
};

type StatusParams = {
  readonly branch: string;
};

const statusOf = ({ branch }: StatusParams): WorktreeStatus => ({
  ...CTX_STATUS,
  branch,
  mainDistance: { kind: 'known', ahead: 4, behind: 0 },
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
});

type KeyParams = {
  readonly key: string;
};

const agentIdOf = ({ key }: KeyParams): AgentId =>
  brandId<AgentId>({ value: `mock-hero-agent-${key}` });

const runIdOf = ({ key }: KeyParams): ProviderRunId =>
  brandId<ProviderRunId>({ value: `mock-hero-run-${key}` });

type HeroAgentSpec = Readonly<{
  key: string;
  name: string;
  kind: Extract<AgentRole, AgentKind>;
  status: Agent['status'];
  ordinal: number;
  mountId: MountId;
  provider: ProviderId;
  model: string;
  effort: EffortLevel | null;
  startedAt: string;
  completedAt: string | null;
  costUsd: number;
}>;

const HERO_AGENTS: ReadonlyArray<HeroAgentSpec> = [
  {
    key: 'planner',
    name: 'Plan the dedupe on the processor event id',
    kind: 'planner',
    status: 'completed',
    ordinal: 1,
    mountId: API_MOUNT_ID,
    provider: 'anthropic',
    model: 'claude-opus-5-5',
    effort: 'high',
    startedAt: '14:52',
    completedAt: '15:04',
    costUsd: 0.61,
  },
  {
    key: 'dedupe',
    name: 'Dedupe credits on the processor event id',
    kind: 'implementer',
    status: 'completed',
    ordinal: 2,
    mountId: API_MOUNT_ID,
    provider: 'codex',
    model: 'gpt-6-astra',
    effort: 'medium',
    startedAt: '15:04',
    completedAt: '15:31',
    costUsd: 0.84,
  },
  {
    key: 'banner',
    name: 'Show a stuck delivery to support',
    kind: 'implementer',
    status: 'completed',
    ordinal: 3,
    mountId: RELAY_MOUNT_ID,
    provider: 'cursor',
    model: 'composer-2.5',
    effort: null,
    startedAt: '15:08',
    completedAt: '15:46',
    costUsd: 0.38,
  },
  {
    key: 'review',
    name: 'Review the dedupe check',
    kind: 'reviewer',
    status: 'completed',
    ordinal: 4,
    mountId: API_MOUNT_ID,
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: null,
    startedAt: '15:31',
    completedAt: '15:49',
    costUsd: 0.29,
  },
  {
    key: 'replay',
    name: 'Fire 10,000 retries at the dedupe check',
    kind: 'tester',
    status: 'running',
    ordinal: 5,
    mountId: REPLAY_MOUNT_ID,
    provider: 'codex',
    model: 'gpt-6-astra',
    effort: 'high',
    startedAt: '15:49',
    completedAt: null,
    costUsd: 0.22,
  },
  {
    key: 'note',
    name: 'Write the support note for a stuck delivery',
    kind: 'scribe',
    status: 'pending',
    ordinal: 6,
    mountId: RELAY_MOUNT_ID,
    provider: 'cursor',
    model: 'kimi-k3',
    effort: null,
    startedAt: '15:52',
    completedAt: null,
    costUsd: 0,
  },
];

type SpecParams = {
  readonly spec: HeroAgentSpec;
};

const agentOf = ({ spec }: SpecParams): Agent => ({
  id: agentIdOf({ key: spec.key }),
  sessionId: SESSION_ID,
  ordinal: spec.ordinal,
  name: spec.name,
  kind: spec.kind,
  status: spec.status,
  runId: runIdOf({ key: spec.key }),
  mountId: spec.mountId,
  startedAt: at({ time: spec.startedAt }),
  ...(spec.completedAt === null ? {} : { completedAt: at({ time: spec.completedAt }) }),
  providerOverride: spec.provider,
  modelOverride: spec.model,
  ...(spec.effort === null ? {} : { effort: spec.effort }),
});

const spanOf = ({ spec }: SpecParams): MeasuredTurnSpan => ({
  agentId: agentIdOf({ key: spec.key }),
  parentAgentId: null,
  agentStatus: spec.status,
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: spec.kind,
  provider: spec.provider,
  model: spec.model,
  effort: spec.effort,
  startedAtMs: ms({ time: spec.startedAt }),
  endedAtMs: spec.completedAt === null ? Date.now() : ms({ time: spec.completedAt }),
  endReason: 'succeeded',
  costUsd: spec.costUsd,
  touchedMountIds: [spec.mountId],
});

const STARTED = HERO_AGENTS.filter((spec) => spec.status !== 'pending');

const RUNNING = HERO_AGENTS.find((spec) => spec.status === 'running') ?? null;

const PASSED: ReadonlyArray<PrCheckRun> = [
  'build',
  'unit',
  'contract',
  'lint',
  'types',
  'migrations',
  'webhook-replay',
  'static-analysis',
].map((name) => ({ name, conclusion: 'success', detailsUrl: null, durationMs: 64_000 }));

type PrParams = {
  readonly number: number;
  readonly title: string;
  readonly repo: string;
  readonly branch: string;
  readonly reviewDecision: PullRequestState['reviewDecision'];
};

const prOf = ({ number, title, repo, branch, reviewDecision }: PrParams): PullRequestState => ({
  number,
  title,
  url: `https://example.invalid/harborline/${repo}/pull/${number}`,
  headSha: 'a41c9e2b7d3f',
  headBranch: branch,
  baseBranch: 'main',
  checks: 'success',
  state: 'open',
  isDraft: false,
  mergeable: true,
  reviewDecision,
  body: '',
  updatedAt: isoNow(),
});

type GithubParams = {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly repo: string;
  readonly pr: PullRequestState;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

const githubOf = ({ mountId, projectId, repo, pr, checks }: GithubParams) => {
  const fetchedAt = isoNow();
  return {
    pr,
    linkedIssues: [],
    fetchedAt,
    failedAt: null,
    loading: false,
    error: null,
    detail: { prNumber: pr.number, comments: [], reviews: [], reviewRequests: [], checks },
    detailFetchedAt: fetchedAt,
    detailLoading: false,
    detailError: null,
    mountId,
    projectId,
    revision: 0,
    repository: `harborline/${repo}`,
    host: 'github.com',
    branch: pr.headBranch,
    prs: [pr],
    links: [],
  };
};

const API_GITHUB = githubOf({
  mountId: API_MOUNT_ID,
  projectId: API_PROJECT_ID,
  repo: 'payments-api',
  pr: prOf({
    number: 318,
    title: 'Stop retried webhooks posting a second credit',
    repo: 'payments-api',
    branch: API_BRANCH,
    reviewDecision: null,
  }),
  checks: PASSED,
});

const RELAY_GITHUB = githubOf({
  mountId: RELAY_MOUNT_ID,
  projectId: RELAY_PROJECT_ID,
  repo: 'notify-relay',
  pr: prOf({
    number: 57,
    title: 'Show retry state on the deliveries screen',
    repo: 'notify-relay',
    branch: RELAY_BRANCH,
    reviewDecision: 'review_required',
  }),
  checks: PASSED.slice(0, 5),
});

const LIVE_MOUNTS = [
  {
    mountId: API_MOUNT_ID,
    sessionId: SESSION_ID,
    projectId: API_PROJECT_ID,
    branch: API_BRANCH,
    createdAt: 1,
    port: null,
    hasFixedPort: false,
    paths: [
      HERO_SHARED_PATH,
      'src/webhooks/applyWebhook.ts',
      'src/db/migrations/0042_event_id.sql',
    ],
  },
  {
    mountId: EXPORT_MOUNT_ID,
    sessionId: EXPORT_SESSION_ID,
    projectId: API_PROJECT_ID,
    branch: 'hl/faster-payout-export',
    createdAt: 2,
    port: null,
    hasFixedPort: false,
    paths: [HERO_SHARED_PATH, 'src/payouts/export.ts'],
  },
];

const EXPORT_TASK: SessionExternalTask = {
  sessionId: EXPORT_SESSION_ID,
  provider: 'linear',
  externalId: 'mock-hero-linear-415',
  identifier: EXPORT_KEY,
  url: 'https://example.invalid/harborline/issue/HBL-415',
  title: 'Speed up the payout export for large merchants',
  createdAt: at({ time: '13:10' }),
};

const EXPORT_SESSION: Session = {
  ...SESSION,
  id: EXPORT_SESSION_ID,
  goal: `[${EXPORT_KEY}] Speed up the payout export for large merchants`,
  state: { kind: 'idle', lastActivityAt: at({ time: '15:20' }) },
  workflowRuns: [],
};

const HERO_SESSION: Session = {
  ...SESSION,
  workflowRuns: [],
  state: { kind: 'running', runId: runIdOf({ key: 'replay' }), startedAt: at({ time: '15:49' }) },
};

const CLAUDE_USED = [0.38, 0.52];

const calmClaudeLimits = (): void => {
  useAppStore.setState((state) => {
    const claude = state.providerLimits.anthropic;
    if (claude === undefined) {
      return {};
    }
    return {
      providerLimits: {
        ...state.providerLimits,
        anthropic: {
          ...claude,
          status: 'ok',
          windows: claude.windows.map((window, index) => ({
            ...window,
            status: 'ok',
            usedFraction: CLAUDE_USED[index] ?? window.usedFraction,
          })),
        },
      },
    };
  });
};

export const seedHero = (): void => {
  seedActivityRunScene();
  const template = useAppStore.getState().projects[0];
  if (template === undefined) {
    throw new Error('The hero scene needs the seeded project.');
  }
  const projects: ReadonlyArray<Project> = [
    { ...template, id: API_PROJECT_ID, name: 'payments-api' },
    { ...template, id: RELAY_PROJECT_ID, name: 'notify-relay' },
  ];
  mockSceneIpc((command, payload) => {
    if (command === 'overlap_read') {
      return LIVE_MOUNTS;
    }
    if (command === 'worktree_status') {
      return statusOf({ branch: mountOfPayload({ payload })?.branch ?? API_BRANCH });
    }
    if (command === 'worktree_diff') {
      return HERO_DIFF_PATCH;
    }
    if (command === 'worktree_changed_files') {
      const mount = mountOfPayload({ payload });
      const stat = mount === null ? undefined : DIFF_STATS[mount.worktreePath];
      return stat === undefined ? null : { paths: [], entries: [], numstat: '', ...stat };
    }
    return null;
  });
  seedShellChrome({
    session: HERO_SESSION,
    siblings: [EXPORT_SESSION],
    branches: { [EXPORT_SESSION_ID]: 'hl/faster-payout-export' },
    telemetryAt: at({ time: '15:50' }),
    lens: null,
  });
  useAppStore.setState({
    projects,
    sessionSlots: {
      [SESSION_ID]: [{ key: 'goal', value: GOAL_LINE, enabled: true }],
    },
    sessionSlotsLoad: { [SESSION_ID]: 'loaded' },
    sessionProjectMounts: { [SESSION_ID]: MOUNTS },
    sessionActiveProject: { [SESSION_ID]: API_PROJECT_ID },
    sessionActiveMount: { [SESSION_ID]: API_MOUNT_ID },
    sessionWorktrees: { [SESSION_ID]: MOUNTS.map((mount) => mount.worktreePath) },
    sessionWorktreeRecords: {
      [SESSION_ID]: MOUNTS.map((mount, index) => ({
        id: `mock-hero-worktree-${index}`,
        sessionId: SESSION_ID,
        worktreePath: mount.worktreePath,
        branch: mount.branch,
        parallelIndex: mount.parallelIndex,
        projectId: mount.projectId,
        mountName: mount.mountName,
        repoSlug: `harborline/${mount.mountName}`,
        createdAt: ms({ time: '14:50' }),
      })),
    },
    sessionPhaseRuns: { [SESSION_ID]: STARTED.map((spec) => agentOf({ spec })) },
    sessionWorkflows: { [SESSION_ID]: [] },
    sessionEvents: { [SESSION_ID]: [] },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    sessionAnsweredQuestions: { [SESSION_ID]: [] },
    sessionDismissedQuestions: { [SESSION_ID]: [] },
    sessionArtifacts: { [SESSION_ID]: [] },
    sessionPlans: { [SESSION_ID]: [] },
    sessionContextItems: { [SESSION_ID]: [] },
    sessionExternalTasks: { [SESSION_ID]: [], [EXPORT_SESSION_ID]: [EXPORT_TASK] },
    resolveQueueView: {},
    sessionResolveQueueItems: {},
    transcripts: {},
    agentTurnState:
      RUNNING === null
        ? {}
        : {
            [agentIdOf({ key: RUNNING.key })]: {
              kind: 'running',
              runId: runIdOf({ key: RUNNING.key }),
              startedAt: at({ time: RUNNING.startedAt }),
            },
          },
    sessionTurnSpans: { [SESSION_ID]: STARTED.map((spec) => spanOf({ spec })) },
    sessionGithub: { [SESSION_ID]: API_GITHUB },
    mountGithub: { [API_MOUNT_ID]: API_GITHUB, [RELAY_MOUNT_ID]: RELAY_GITHUB },
    mountRequests: {},
    sessionProjectPrs: {},
    autoTreeViews: { [SESSION_ID]: [] },
    loadAutoTrees: async () => undefined,
    loadSessionMounts: async () => [],
    loadSessionTurnSpans: async () => undefined,
    loadWorkspaceDurationHistory: async () => undefined,
    selectedAgentId: {},
    drawer: null,
  });
  seedBrandLimits();
  calmClaudeLimits();
  useAppStore.getState().openDrawer({
    kind: 'file-diff',
    sessionId: SESSION_ID,
    payload: { source: { kind: 'worktree', worktreePath: API_PATH }, path: HERO_SHARED_PATH },
  });
};
