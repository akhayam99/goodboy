// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type OpenQuestion,
  type OpenQuestionId,
  type Project,
  type ProjectId,
  type ProviderRunId,
  type Session,
  type SessionId,
  type TurnState,
  type WorkspaceId,
} from '@goodboy/types';
import type { SessionWorktree } from '@goodboy/db';
import { aSession, aWorkflowRun, aWorkspace, anAgent } from '@goodboy/types/testing';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

type ReconcileParams = {
  readonly sessions: ReadonlyArray<Session>;
};

type VerifyParams = {
  readonly candidatesBySession: ReadonlyMap<SessionId, ReadonlyArray<SessionWorktree>>;
};

const h = vi.hoisted(() => ({
  sessions: [] as ReadonlyArray<Session>,
  worktrees: new Map<SessionId, ReadonlyArray<SessionWorktree>>(),
  projects: [] as ReadonlyArray<Project>,
  updateSessionWriteDestination: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    getSetting: vi.fn(async () => null),
    listAgentsForSessions: vi.fn(async () => new Map()),
    listAgentSummariesForSessions: vi.fn(async () => []),
    listAgentOutputSummaries: vi.fn(async () => []),
    listDecidedNudgeEventsForSessions: vi.fn(async () => []),
    listOpenQuestionsForSessions: vi.fn(async () => []),
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
  }),
);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/chat/turn', () => {
  const listLiveRunIds = vi.fn(async () => []);
  return {
    cancelTurn: vi.fn(async () => undefined),
    listLiveRunIds,
    probeLiveRunIds: () => listLiveRunIds(),
  };
});
vi.mock('../../../features/workspace/window', () => ({ isMainWindow: () => false }));
vi.mock('../../../features/budget/budget', () => ({
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetRuleList: vi.fn(async () => []),
}));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeStepDefList: vi.fn(async () => []),
  invokeWorkflowList: vi.fn(async () => []),
  invokeWorkflowsForSession: vi.fn(async () => []),
}));
vi.mock('../sessions/reconcileSessionRuns', () => ({
  reattachableTurn: vi.fn(() => null),
  reconcileLoadedAgent: vi.fn(),
  reconcileLoadedSessions: vi.fn(async ({ sessions }: ReconcileParams) => sessions),
}));
vi.mock('../project-mounts/verify/verifyWorkspaceWorktrees', () => ({
  verifyWorkspaceWorktrees: vi.fn(async ({ candidatesBySession }: VerifyParams) => ({
    availableBySession: candidatesBySession,
  })),
}));
vi.mock('../transcripts/buffer', () => ({ clearPendingTurnEvents: vi.fn() }));

import { cancelTurn, listLiveRunIds } from '../../../features/chat/turn';
import { verifyWorkspaceWorktrees } from '../project-mounts/verify/verifyWorkspaceWorktrees';
import {
  listAgentSummariesForSessions,
  listAgentsForSessions,
  listOpenQuestionsForSessions,
  listSessionsForWorkspace,
} from '@goodboy/db';
import { reconcileLoadedAgent, reconcileLoadedSessions } from '../sessions/reconcileSessionRuns';
import { cancelledRunIds } from '../sessions/sessionMutators';
import { retryWorkspaceFacts } from './retryWorkspaceFacts';
import { switchEpoch } from './switchEpoch';
import { setCurrentWorkspace } from './setCurrentWorkspace';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const PROJECT_ID = 'project-1' as ProjectId;
const UNSELECTED_SESSION_ID = 'session-unselected' as SessionId;
const RESTORED_SESSION_ID = 'session-restored' as SessionId;
const REPAIRED_SESSION_ID = 'session-repaired' as SessionId;
const RESTORED_MOUNT_ID = 'mount-restored-b' as MountId;
const REPAIRED_MOUNT_ID = 'mount-repaired' as MountId;
const NOW = '2026-09-12T00:00:00.000Z' as IsoDateTime;

const overrides = {
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
  defaultBranchTemplate: null,
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
};

const harness = (initial: Partial<AppStore> = {}): Harness => {
  let state = {
    workspaces: [{ id: WORKSPACE_ID, lastAccessedAt: NOW }],
    sessions: [],
    sessionPhaseRuns: {},
    sessionOpenQuestions: {},
    sessionDismissedNextSteps: {},
    autoTreeViews: {},
    agentTurnState: {},
    orchestratingWorkflowRuns: {},
    stopWorkflowRunNow: vi.fn(async () => 'stopped' as const),
    cancelTurnConfirmed: vi.fn(async () => ({ outcome: 'exited' as const, exitedAt: NOW })),
    reportError: vi.fn(async () => undefined),
    projects: [],
    currentWorkspaceId: null,
    currentSessionId: null,
    loadIntegrations: vi.fn(async () => undefined),
    loadWorkspaceOverrides: vi.fn(),
    refreshUnreadWorkspaces: vi.fn(),
    loadDormantSpend: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
    ...initial,
  } as unknown as AppStore;
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
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.projects = [project];
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

  it('releases the board as soon as the rows are in, without waiting for a pull request sweep', async () => {
    const store = harness({ boardReady: false });

    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    expect(store.state.boardReady).toBe(true);
  });
});

describe('setCurrentWorkspace run recovery', () => {
  it('stores the reconciled sessions instead of the database-running rows', async () => {
    const RUN_ID = 'run-stale' as ProviderRunId;
    const liveRunIds = new Set<string>();
    h.sessions = [
      {
        ...session({ id: RESTORED_SESSION_ID }),
        state: { kind: 'running', runId: RUN_ID, startedAt: NOW },
      } satisfies Session,
    ];
    vi.mocked(listLiveRunIds).mockResolvedValueOnce(liveRunIds);
    vi.mocked(reconcileLoadedSessions).mockImplementationOnce(async ({ sessions }) =>
      sessions.map((loaded) => ({ ...loaded, state: { kind: 'idle', lastActivityAt: NOW } })),
    );
    const store = harness();

    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    expect(reconcileLoadedSessions).toHaveBeenCalledWith(
      expect.objectContaining({ sessions: h.sessions, liveRunIds }),
    );
    expect(store.state.sessions.map((stored) => stored.state.kind)).toEqual(['idle']);
  });

  it('keeps an agent that waits for permission blocked on the board after a reload', async () => {
    const RUN_ID = brandId<ProviderRunId>({ value: 'run-ask' });
    const asking = anAgent({ sessionId: RESTORED_SESSION_ID, status: 'running', runId: RUN_ID });
    const waiting: TurnState = { kind: 'blocked', runId: RUN_ID, blockedAt: NOW };
    h.sessions = [session({ id: RESTORED_SESSION_ID })];
    vi.mocked(listAgentSummariesForSessions).mockResolvedValueOnce([asking]);
    vi.mocked(listAgentsForSessions).mockResolvedValueOnce(
      new Map([[RESTORED_SESSION_ID, [asking]]]),
    );
    vi.mocked(reconcileLoadedAgent).mockResolvedValueOnce({ agent: asking, waiting });
    const store = harness();

    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    expect(store.state.sessionPhaseRuns[RESTORED_SESSION_ID]).toEqual([asking]);
    expect(store.state.agentTurnState[asking.id]).toEqual(waiting);
    expect(store.state.boardReady).toBe(true);
  });
});

describe('setCurrentWorkspace facts before the board', () => {
  const question = {
    id: brandId<OpenQuestionId>({ value: 'question-backoff' }),
    sessionId: RESTORED_SESSION_ID,
    text: 'Should the retries back off?',
    suggestedAnswers: [],
    isBlocking: false,
    userAnswer: null,
    status: 'open',
    createdAt: NOW,
  } satisfies OpenQuestion;

  it('reads the open questions while the skeleton shows and draws the lanes with them', async () => {
    const store = harness();
    const switching: Array<WorkspaceId | null> = [];
    vi.mocked(listOpenQuestionsForSessions).mockImplementationOnce(async () => {
      switching.push(store.state.switchingToWorkspaceId);
      return [question];
    });

    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    expect(switching).toEqual([WORKSPACE_ID]);
    expect(store.state.sessionOpenQuestions[RESTORED_SESSION_ID]).toEqual([question]);
    expect(store.state.sessionOpenQuestions[UNSELECTED_SESSION_ID]).toEqual([]);
    expect(store.state.workspaceFactsError).toBeNull();
    expect(store.state.boardReady).toBe(true);
  });

  it('draws the board with one line and Retry when the facts cannot be read, then Retry fills them', async () => {
    const store = harness();
    vi.mocked(listOpenQuestionsForSessions).mockRejectedValueOnce(new Error('database is locked'));

    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    expect(store.state.boardReady).toBe(true);
    expect(store.state.workspaceFactsError).toBe('database is locked');
    expect(store.state.sessionOpenQuestions[RESTORED_SESSION_ID]).toBeUndefined();

    vi.mocked(listOpenQuestionsForSessions).mockResolvedValueOnce([question]);
    await retryWorkspaceFacts(store)({ workspaceId: WORKSPACE_ID });

    expect(store.state.workspaceFactsError).toBeNull();
    expect(store.state.sessionOpenQuestions[RESTORED_SESSION_ID]).toEqual([question]);
  });

  it('keeps the error when Retry fails again, and drops a Retry answer that lands after a switch', async () => {
    const store = harness();
    vi.mocked(listOpenQuestionsForSessions).mockRejectedValueOnce(new Error('database is locked'));
    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    vi.mocked(listOpenQuestionsForSessions).mockRejectedValueOnce(new Error('disk I/O error'));
    await retryWorkspaceFacts(store)({ workspaceId: WORKSPACE_ID });

    expect(store.state.workspaceFactsError).toBe('disk I/O error');

    vi.mocked(listOpenQuestionsForSessions).mockImplementationOnce(async () => {
      switchEpoch.value += 1;
      return [question];
    });
    await retryWorkspaceFacts(store)({ workspaceId: WORKSPACE_ID });

    expect(store.state.workspaceFactsError).toBe('disk I/O error');
    expect(store.state.sessionOpenQuestions[RESTORED_SESSION_ID]).toBeUndefined();
  });
});

describe('setCurrentWorkspace stops all live work', () => {
  it('stops a blocked turn as stopped by you and stops a deciding workflow run', async () => {
    vi.mocked(listLiveRunIds).mockResolvedValueOnce(new Set(['run-blocked']));
    const waiting = aSession({ workspaceId: WORKSPACE_ID });
    const agent = anAgent({ sessionId: waiting.id });
    const run = aWorkflowRun();
    const deciding = aSession({ workspaceId: WORKSPACE_ID, workflowRuns: [run] });
    const stopWorkflowRunNow = vi.fn(async () => 'stopped' as const);
    const cancelTurnConfirmed = vi.fn(async () => ({ outcome: 'exited' as const, exitedAt: NOW }));
    const store = harness({
      sessions: [waiting, deciding],
      sessionPhaseRuns: { [waiting.id]: [agent] },
      agentTurnState: {
        [agent.id]: { kind: 'blocked', runId: 'run-blocked' as ProviderRunId, blockedAt: NOW },
      },
      orchestratingWorkflowRuns: { [run.id]: true },
      stopWorkflowRunNow,
      cancelTurnConfirmed,
    });

    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    expect(cancelTurnConfirmed).toHaveBeenCalledWith({
      sessionId: waiting.id,
      agentId: agent.id,
      reason: 'leave',
    });
    expect(cancelTurn).not.toHaveBeenCalled();
    expect(stopWorkflowRunNow).toHaveBeenCalledWith(deciding.id, run.id);
  });

  describe('when a process survives the stop', () => {
    const OTHER_ID = brandId<WorkspaceId>({ value: 'workspace-northwind' });
    const live = aSession({ workspaceId: WORKSPACE_ID });
    const agent = anAgent({ sessionId: live.id, status: 'running' });
    const running: TurnState = {
      kind: 'running',
      runId: brandId<ProviderRunId>({ value: 'run-stuck' }),
      startedAt: NOW,
    };

    const stuckStore = () =>
      harness({
        workspaces: [aWorkspace({ id: WORKSPACE_ID }), aWorkspace({ id: OTHER_ID })],
        currentWorkspaceId: WORKSPACE_ID,
        sessions: [live],
        sessionPhaseRuns: { [live.id]: [agent] },
        agentTurnState: { [agent.id]: running },
        cancelTurnConfirmed: vi.fn(async () => ({
          outcome: 'still_running' as const,
          exitedAt: null,
        })),
      });

    it('stays here with everything that controls it, and says so', async () => {
      const store = stuckStore();

      await setCurrentWorkspace(store.set, store.get)(OTHER_ID);

      expect(store.state.currentWorkspaceId).toBe(WORKSPACE_ID);
      expect(store.state.sessions).toEqual([live]);
      expect(store.state.sessionPhaseRuns[live.id]).toEqual([agent]);
      expect(store.state.agentTurnState[agent.id]).toEqual(running);
      expect(store.state.switchingToWorkspaceId).toBeNull();
      expect(store.state.workspaceSwitchError).toEqual({
        workspaceId: OTHER_ID,
        message: expect.stringContaining('An agent did not stop'),
      });
      expect(store.state.reportError).toHaveBeenCalledOnce();
    });

    it('says so too when the switch has no target', async () => {
      const store = stuckStore();

      await setCurrentWorkspace(store.set, store.get)(null);

      expect(store.state.currentWorkspaceId).toBe(WORKSPACE_ID);
      expect(store.state.agentTurnState[agent.id]).toEqual(running);
      expect(store.state.workspaceSwitchError).toBeNull();
      expect(store.state.reportError).toHaveBeenCalledOnce();
    });

    it('switches on Retry once the process exited', async () => {
      const store = stuckStore();
      const switchTo = setCurrentWorkspace(store.set, store.get);
      await switchTo(OTHER_ID);
      store.set({
        cancelTurnConfirmed: vi.fn(async () => ({ outcome: 'exited' as const, exitedAt: NOW })),
      });

      await switchTo(OTHER_ID);

      expect(store.state.currentWorkspaceId).toBe(OTHER_ID);
      expect(store.state.workspaceSwitchError).toBeNull();
    });
  });

  it('keeps a permission wait whose run ended, so the ask is there on return', async () => {
    vi.mocked(listLiveRunIds).mockResolvedValueOnce(new Set());
    const waiting = aSession({ workspaceId: WORKSPACE_ID });
    const agent = anAgent({ sessionId: waiting.id });
    const cancelTurnConfirmed = vi.fn(async () => ({ outcome: 'exited' as const, exitedAt: NOW }));
    const store = harness({
      sessions: [waiting],
      sessionPhaseRuns: { [waiting.id]: [agent] },
      agentTurnState: {
        [agent.id]: {
          kind: 'blocked',
          runId: brandId<ProviderRunId>({ value: 'run-ended' }),
          blockedAt: NOW,
        },
      },
      cancelTurnConfirmed,
    });

    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    expect(cancelTurnConfirmed).not.toHaveBeenCalled();
    expect(cancelTurn).not.toHaveBeenCalled();
  });

  it('marks a running turn the store has no agent row for as cancelled before the kill', async () => {
    const orphan = brandId<ProviderRunId>({ value: 'run-orphan' });
    const running = aSession({
      workspaceId: WORKSPACE_ID,
      state: { kind: 'running', runId: orphan, startedAt: NOW },
    });
    const store = harness({ sessions: [running] });

    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    expect(cancelTurn).toHaveBeenCalledWith('run-orphan');
    expect(cancelledRunIds.has(orphan)).toBe(true);
    cancelledRunIds.delete(orphan);
  });

  it('stops nothing when nothing is live', async () => {
    const stopWorkflowRunNow = vi.fn(async () => 'stopped' as const);
    const cancelTurnConfirmed = vi.fn(async () => ({ outcome: 'exited' as const, exitedAt: NOW }));
    const store = harness({
      sessions: [aSession({ workspaceId: WORKSPACE_ID })],
      stopWorkflowRunNow,
      cancelTurnConfirmed,
    });

    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    expect(cancelTurn).not.toHaveBeenCalled();
    expect(cancelTurnConfirmed).not.toHaveBeenCalled();
    expect(stopWorkflowRunNow).not.toHaveBeenCalled();
  });
});

describe('setCurrentWorkspace latest only and read first', () => {
  const HARBORLINE_ID = aWorkspace({ name: 'Harborline' }).id;
  const NORTHWIND_ID = aWorkspace({ name: 'Northwind', slug: 'northwind' }).id;

  afterEach(() => {
    vi.mocked(listSessionsForWorkspace).mockImplementation(async () => h.sessions);
  });

  it('keeps only the rows of the newest switch when an older answer arrives late', async () => {
    const harborlineRow = aSession({ workspaceId: HARBORLINE_ID });
    const northwindRow = aSession({ workspaceId: NORTHWIND_ID });
    let releaseHarborline: (rows: ReadonlyArray<Session>) => void = () => undefined;
    vi.mocked(listSessionsForWorkspace).mockImplementation(async (_db, workspaceId) => {
      if (workspaceId === HARBORLINE_ID) {
        return new Promise<ReadonlyArray<Session>>((resolve) => {
          releaseHarborline = resolve;
        });
      }
      return [northwindRow];
    });
    const store = harness();

    const switchTo = setCurrentWorkspace(store.set, store.get);

    const first = switchTo(HARBORLINE_ID);
    const second = switchTo(NORTHWIND_ID);
    await second;
    releaseHarborline([harborlineRow]);
    await first;

    expect(store.state.currentWorkspaceId).toBe(NORTHWIND_ID);
    expect(store.state.sessions.map((row) => row.id)).toEqual([northwindRow.id]);
  });

  it('keeps the previous workspace whole and names the failure when a read fails', async () => {
    const harborlineRow = aSession({ workspaceId: HARBORLINE_ID });
    vi.mocked(listSessionsForWorkspace).mockRejectedValueOnce(new Error('disk read failed'));
    const store = harness({
      currentWorkspaceId: HARBORLINE_ID,
      sessions: [harborlineRow],
      boardReady: true,
    });

    await setCurrentWorkspace(store.set, store.get)(NORTHWIND_ID);

    expect(store.state.currentWorkspaceId).toBe(HARBORLINE_ID);
    expect(store.state.sessions).toEqual([harborlineRow]);
    expect(store.state.boardReady).toBe(true);
    expect(store.state.switchingToWorkspaceId).toBeNull();
    expect(store.state.workspaceSwitchError).toEqual({
      workspaceId: NORTHWIND_ID,
      message: 'disk read failed',
    });
  });

  it('switches on the retry after a failed read and clears the error', async () => {
    const northwindRow = aSession({ workspaceId: NORTHWIND_ID });
    vi.mocked(listSessionsForWorkspace).mockRejectedValueOnce(new Error('disk read failed'));
    vi.mocked(listSessionsForWorkspace).mockResolvedValueOnce([northwindRow]);
    const store = harness({ currentWorkspaceId: HARBORLINE_ID });
    const switchTo = setCurrentWorkspace(store.set, store.get);

    await switchTo(NORTHWIND_ID);
    expect(store.state.workspaceSwitchError).not.toBeNull();
    await switchTo(NORTHWIND_ID);

    expect(store.state.currentWorkspaceId).toBe(NORTHWIND_ID);
    expect(store.state.sessions.map((row) => row.id)).toEqual([northwindRow.id]);
    expect(store.state.workspaceSwitchError).toBeNull();
  });

  it('names the target at the click and flips the id and the rows together', async () => {
    const harborlineRow = aSession({ workspaceId: HARBORLINE_ID });
    const northwindRow = aSession({ workspaceId: NORTHWIND_ID });
    let releaseNorthwind: (rows: ReadonlyArray<Session>) => void = () => undefined;
    vi.mocked(listSessionsForWorkspace).mockImplementation(
      async () =>
        new Promise<ReadonlyArray<Session>>((resolve) => {
          releaseNorthwind = resolve;
        }),
    );
    const store = harness({
      currentWorkspaceId: HARBORLINE_ID,
      sessions: [harborlineRow],
      boardReady: true,
    });

    const switching = setCurrentWorkspace(store.set, store.get)(NORTHWIND_ID);

    expect(store.state.switchingToWorkspaceId).toBe(NORTHWIND_ID);
    await vi.waitFor(() => {
      expect(listSessionsForWorkspace).toHaveBeenCalled();
    });
    expect(store.state.currentWorkspaceId).toBe(HARBORLINE_ID);
    expect(store.state.sessions).toEqual([harborlineRow]);

    releaseNorthwind([northwindRow]);
    await switching;

    expect(store.state.currentWorkspaceId).toBe(NORTHWIND_ID);
    expect(store.state.sessions.map((row) => row.id)).toEqual([northwindRow.id]);
    expect(store.state.switchingToWorkspaceId).toBeNull();
  });

  it('shows the latest target when a second switch starts while the first loads', async () => {
    const northwindRow = aSession({ workspaceId: NORTHWIND_ID });
    vi.mocked(listSessionsForWorkspace).mockImplementation(async (_db, workspaceId) => {
      if (workspaceId === HARBORLINE_ID) {
        return new Promise<ReadonlyArray<Session>>(() => undefined);
      }
      return [northwindRow];
    });
    const store = harness({ currentWorkspaceId: null });
    const switchTo = setCurrentWorkspace(store.set, store.get);

    void switchTo(HARBORLINE_ID);
    const second = switchTo(NORTHWIND_ID);

    expect(store.state.switchingToWorkspaceId).toBe(NORTHWIND_ID);
    await second;
    expect(store.state.switchingToWorkspaceId).toBeNull();
  });

  it('cancels the pending switch when the owner picks the open workspace again', async () => {
    const harborlineRow = aSession({ workspaceId: HARBORLINE_ID });
    const northwindRow = aSession({ workspaceId: NORTHWIND_ID });
    let releaseNorthwind: (rows: ReadonlyArray<Session>) => void = () => undefined;
    vi.mocked(listSessionsForWorkspace).mockImplementation(async (_db, workspaceId) => {
      if (workspaceId === NORTHWIND_ID) {
        return new Promise<ReadonlyArray<Session>>((resolve) => {
          releaseNorthwind = resolve;
        });
      }
      return [harborlineRow];
    });
    const store = harness({ currentWorkspaceId: HARBORLINE_ID, sessions: [harborlineRow] });
    const switchTo = setCurrentWorkspace(store.set, store.get);

    const pending = switchTo(NORTHWIND_ID);
    await vi.waitFor(() => {
      expect(listSessionsForWorkspace).toHaveBeenCalledWith(expect.anything(), NORTHWIND_ID);
    });
    await switchTo(HARBORLINE_ID);
    releaseNorthwind([northwindRow]);
    await pending;

    expect(store.state.currentWorkspaceId).toBe(HARBORLINE_ID);
    expect(store.state.switchingToWorkspaceId).toBeNull();
    expect(store.state.sessions.map((row) => row.id)).toEqual([harborlineRow.id]);
  });

  it('drops the error of a failed older switch when a newer switch is current', async () => {
    const northwindRow = aSession({ workspaceId: NORTHWIND_ID });
    let failHarborline: (error: Error) => void = () => undefined;
    vi.mocked(listSessionsForWorkspace).mockImplementation(async (_db, workspaceId) => {
      if (workspaceId === HARBORLINE_ID) {
        return new Promise<ReadonlyArray<Session>>((_resolve, reject) => {
          failHarborline = reject;
        });
      }
      return [northwindRow];
    });
    const store = harness();
    const switchTo = setCurrentWorkspace(store.set, store.get);

    const first = switchTo(HARBORLINE_ID);
    await vi.waitFor(() => {
      expect(listSessionsForWorkspace).toHaveBeenCalledWith(expect.anything(), HARBORLINE_ID);
    });
    await switchTo(NORTHWIND_ID);
    failHarborline(new Error('late failure'));
    await first;

    expect(store.state.currentWorkspaceId).toBe(NORTHWIND_ID);
    expect(store.state.workspaceSwitchError).toBeNull();
  });
});

describe('setCurrentWorkspace background verification', () => {
  type Available = ReadonlyMap<SessionId, ReadonlyArray<SessionWorktree>>;

  type VerifyGate = {
    readonly release: (available: Available) => void;
    readonly settled: Promise<void>;
  };

  const gateVerification = (): VerifyGate => {
    let release: (available: Available) => void = () => undefined;
    const answer = new Promise<Available>((resolve) => {
      release = resolve;
    });
    vi.mocked(verifyWorkspaceWorktrees).mockImplementationOnce(async () => ({
      availableBySession: await answer,
    }));
    return { release, settled: answer.then(() => undefined) };
  };

  const withoutMount = ({ sessionId, mountId }: { sessionId: SessionId; mountId: string }) =>
    new Map<SessionId, ReadonlyArray<SessionWorktree>>(
      [...h.worktrees].map(([id, rows]) => [
        id,
        id === sessionId ? rows.filter((row) => row.id !== mountId) : rows,
      ]),
    );

  it('flips the workspace from the unverified rows without waiting for git', async () => {
    gateVerification();
    const store = harness();

    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);

    expect(store.state.currentWorkspaceId).toBe(WORKSPACE_ID);
    expect(store.state.sessionProjectMounts[UNSELECTED_SESSION_ID]).toHaveLength(2);
    expect(store.state.boardReady).toBe(true);
  });

  it('patches only the sessions that lost a mount once git answers', async () => {
    const gate = gateVerification();
    const store = harness();
    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);
    const untouched = store.state.sessionProjectMounts[RESTORED_SESSION_ID];

    gate.release(withoutMount({ sessionId: UNSELECTED_SESSION_ID, mountId: 'mount-unselected-b' }));
    await gate.settled;
    await vi.waitFor(() => {
      expect(store.state.sessionProjectMounts[UNSELECTED_SESSION_ID]).toHaveLength(1);
    });

    expect(store.state.sessionWorktrees[UNSELECTED_SESSION_ID]).toHaveLength(1);
    expect(store.state.sessionProjectMounts[RESTORED_SESSION_ID]).toBe(untouched);
  });

  it('repairs the write destination of a session whose active mount went missing', async () => {
    const gate = gateVerification();
    const store = harness();
    await setCurrentWorkspace(store.set, store.get)(WORKSPACE_ID);
    expect(store.state.sessionActiveMount[RESTORED_SESSION_ID]).toBe(RESTORED_MOUNT_ID);

    gate.release(withoutMount({ sessionId: RESTORED_SESSION_ID, mountId: RESTORED_MOUNT_ID }));
    await gate.settled;
    await vi.waitFor(() => {
      expect(store.state.sessionActiveMount[RESTORED_SESSION_ID]).toBe('mount-restored-a');
    });

    expect(h.updateSessionWriteDestination).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: RESTORED_SESSION_ID, mountId: 'mount-restored-a' }),
    );
  });

  it('drops the verdict of a workspace that is no longer open', async () => {
    const gate = gateVerification();
    const store = harness();
    const switchTo = setCurrentWorkspace(store.set, store.get);
    await switchTo(WORKSPACE_ID);
    const mountsBefore = store.state.sessionProjectMounts;

    await switchTo(null);
    gate.release(withoutMount({ sessionId: UNSELECTED_SESSION_ID, mountId: 'mount-unselected-b' }));
    await gate.settled;
    await Promise.resolve();

    expect(store.state.sessionProjectMounts).not.toBe(mountsBefore);
    expect(store.state.sessionProjectMounts).toEqual({});
  });
});
