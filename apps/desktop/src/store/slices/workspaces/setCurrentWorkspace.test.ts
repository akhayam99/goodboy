import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  ClusterCompletionHold,
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  Session,
  SessionId,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { SessionWorktree } from '@goodboy/db';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

type ReconcileParams = {
  readonly sessions: ReadonlyArray<Session>;
};

type VerifyParams = {
  readonly candidates: ReadonlyArray<SessionWorktree>;
};

const h = vi.hoisted(() => ({
  sessions: [] as ReadonlyArray<Session>,
  worktrees: new Map<SessionId, ReadonlyArray<SessionWorktree>>(),
  projects: [] as ReadonlyArray<Project>,
  holds: new Map<SessionId, ReadonlyArray<ClusterCompletionHold>>(),
  updateSessionWriteDestination: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  listAgentsForSessions: vi.fn(async () => new Map()),
  listExternalTasksForWorkspace: vi.fn(async () => []),
  listProjectsForWorkspace: vi.fn(async () => h.projects),
  listSessionsForWorkspace: vi.fn(async () => h.sessions),
  listWorktreesForSessions: vi.fn(async () => h.worktrees),
  setSetting: vi.fn(async () => undefined),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  touchWorkspaceLastAccessed: vi.fn(async () => undefined),
  updateSessionActiveProject: vi.fn(async () => undefined),
  updateSessionWriteDestination: h.updateSessionWriteDestination,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/chat/turn', () => ({
  cancelTurn: vi.fn(async () => undefined),
  listLiveRunIds: vi.fn(async () => []),
}));
vi.mock('../../../features/workspace/window', () => ({ isMainWindow: () => false }));
vi.mock('../../../features/budget/budget', () => ({
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetRuleList: vi.fn(async () => []),
}));
vi.mock('../../../features/skills/skills', () => ({
  invokeSkillList: vi.fn(async () => []),
}));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeClusterCompletionHolds: vi.fn(
    async ({ sessionId }: { readonly sessionId: SessionId }) => h.holds.get(sessionId) ?? [],
  ),
  invokeStepDefList: vi.fn(async () => []),
  invokeWorkflowList: vi.fn(async () => []),
  invokeWorkflowsForSession: vi.fn(async () => []),
}));
vi.mock('../sessions/reconcileSessionRuns', () => ({
  reconcileLoadedAgent: vi.fn(),
  reconcileLoadedSessions: vi.fn(async ({ sessions }: ReconcileParams) => sessions),
}));
vi.mock('../project-mounts/verifyAvailableWorktrees', () => ({
  verifyAvailableWorktrees: vi.fn(async ({ candidates }: VerifyParams) => candidates),
}));
vi.mock('../transcripts/buffer', () => ({ clearPendingTurnEvents: vi.fn() }));

import { setCurrentWorkspace } from './setCurrentWorkspace';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const PROJECT_ID = 'project-1' as ProjectId;
const UNSELECTED_SESSION_ID = 'session-unselected' as SessionId;
const RESTORED_SESSION_ID = 'session-restored' as SessionId;
const REPAIRED_SESSION_ID = 'session-repaired' as SessionId;
const RESTORED_MOUNT_ID = 'mount-restored-b' as MountId;
const REPAIRED_MOUNT_ID = 'mount-repaired' as MountId;
const NOW = '2026-09-12T00:00:00.000Z' as IsoDateTime;

const completionHold: ClusterCompletionHold = {
  id: 'hold-1',
  sessionId: UNSELECTED_SESSION_ID,
  workflowRunId: null,
  containerAgentId: 'container-1' as AgentId,
  sourceAgentId: 'source-1' as AgentId,
  sourceTurnId: 'turn-1',
  reason: 'missing-outcome',
  findings: [],
  state: 'open',
  resolutionEvidence: null,
  resolvedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const overrides = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
} satisfies Project['overrides'];

const project: Project = {
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'app',
  rootPath: '/repos/app',
  kind: 'repo',
  baseBranch: 'main',
  overrides,
  createdAt: NOW,
  updatedAt: NOW,
};

type SessionParams = {
  readonly id: SessionId;
  readonly activeMountId?: MountId;
};

const session = ({ id, activeMountId }: SessionParams): Session => ({
  id,
  workspaceId: WORKSPACE_ID,
  goal: 'goal',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  ...(activeMountId !== undefined && { activeMountId }),
  createdAt: NOW,
  updatedAt: NOW,
});

type WorktreeParams = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly parallelIndex: number;
};

const worktree = ({ id, sessionId, parallelIndex }: WorktreeParams): SessionWorktree => ({
  id,
  sessionId,
  worktreePath: `/repos/app/.goodboy/worktrees/${id}`,
  branch: `feature/${id}`,
  parallelIndex,
  projectId: PROJECT_ID,
  mountName: id,
  revision: 0,
  createdAt: 0,
});

type Harness = {
  readonly state: AppStore;
  readonly set: SetFn;
  readonly get: GetFn;
  readonly selectedSessionSnapshots: ReadonlyArray<{
    readonly hasCachedAgents: boolean;
    readonly holds: ReadonlyArray<ClusterCompletionHold>;
  }>;
  readonly advanceSnapshots: ReadonlyArray<ReadonlyArray<ClusterCompletionHold>>;
};

const harness = (): Harness => {
  const selectedSessionSnapshots: Array<{
    readonly hasCachedAgents: boolean;
    readonly holds: ReadonlyArray<ClusterCompletionHold>;
  }> = [];
  const advanceSnapshots: Array<ReadonlyArray<ClusterCompletionHold>> = [];
  let state = {
    workspaces: [{ id: WORKSPACE_ID, lastAccessedAt: NOW }],
    sessions: [],
    projects: [],
    currentWorkspaceId: null,
    currentSessionId: null,
    loadIntegrations: vi.fn(async () => undefined),
    loadWorkspaceOverrides: vi.fn(),
    refreshUnreadWorkspaces: vi.fn(),
    maybeAutoAdvanceWorkflow: vi.fn(async (sessionId: SessionId) => {
      advanceSnapshots.push(state.clusterCompletionHolds[sessionId] ?? []);
    }),
  } as unknown as AppStore;
  state = {
    ...state,
    setCurrentSession: vi.fn(async (sessionId: SessionId | null) => {
      if (sessionId === null) {
        return;
      }
      selectedSessionSnapshots.push({
        hasCachedAgents: state.sessionPhaseRuns[sessionId] !== undefined,
        holds: state.clusterCompletionHolds[sessionId] ?? [],
      });
    }),
  };
  const set: SetFn = (update) => {
    const patch = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...patch };
  };
  return {
    get state() {
      return state;
    },
    set,
    get: () => state,
    selectedSessionSnapshots,
    advanceSnapshots,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.projects = [project];
  h.holds = new Map();
  h.sessions = [
    session({ id: UNSELECTED_SESSION_ID }),
    session({ id: RESTORED_SESSION_ID, activeMountId: RESTORED_MOUNT_ID }),
    session({ id: REPAIRED_SESSION_ID }),
  ];
  h.worktrees = new Map<SessionId, ReadonlyArray<SessionWorktree>>([
    [
      UNSELECTED_SESSION_ID,
      [
        worktree({ id: 'mount-unselected-a', sessionId: UNSELECTED_SESSION_ID, parallelIndex: 0 }),
        worktree({ id: 'mount-unselected-b', sessionId: UNSELECTED_SESSION_ID, parallelIndex: 1 }),
      ],
    ],
    [
      RESTORED_SESSION_ID,
      [
        worktree({ id: 'mount-restored-a', sessionId: RESTORED_SESSION_ID, parallelIndex: 0 }),
        worktree({ id: RESTORED_MOUNT_ID, sessionId: RESTORED_SESSION_ID, parallelIndex: 1 }),
      ],
    ],
    [
      REPAIRED_SESSION_ID,
      [worktree({ id: REPAIRED_MOUNT_ID, sessionId: REPAIRED_SESSION_ID, parallelIndex: 0 })],
    ],
  ]);
});

describe('setCurrentWorkspace mount hydration', () => {
  it('omits an unselected entry while retaining restored and repaired entries', async () => {
    const store = harness();

    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    expect(store.state.sessionActiveMount[UNSELECTED_SESSION_ID]).toBeUndefined();
    expect(store.state.sessionActiveMount[RESTORED_SESSION_ID]).toBe(RESTORED_MOUNT_ID);
    expect(store.state.sessionActiveMount[REPAIRED_SESSION_ID]).toBe(REPAIRED_MOUNT_ID);
  });

  it('hydrates completion holds before selecting a session with cached agents', async () => {
    h.sessions = [
      {
        ...session({ id: UNSELECTED_SESSION_ID }),
        workflowRuns: [
          {
            id: 'queued-run' as WorkflowRunId,
            workflowId: 'workflow-1' as WorkflowId,
            ordinal: 0,
            currentStep: 0,
            autoRun: true,
            triggerMode: 'after_run',
            chainAfterId: 'predecessor-run' as WorkflowRunId,
            executionMode: 'static',
          },
        ],
      },
    ];
    h.worktrees = new Map();
    h.holds = new Map([[UNSELECTED_SESSION_ID, [completionHold]]]);
    const store = harness();

    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    expect(store.selectedSessionSnapshots).toEqual([
      { hasCachedAgents: true, holds: [completionHold] },
    ]);
    expect(store.state.clusterCompletionHolds[UNSELECTED_SESSION_ID]).toEqual([completionHold]);
    await vi.waitFor(() => {
      expect(store.advanceSnapshots).toEqual([[completionHold]]);
    });
  });
});
