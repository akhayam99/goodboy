import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BudgetAlert,
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { buildStorySession, resetStorySpies, storySpies } from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const WS_A = 'workspace-a' as WorkspaceId;
const WS_B = 'workspace-b' as WorkspaceId;
const SESSION_IDLE = 'session-idle' as SessionId;
const SESSION_RUNNING = 'session-running' as SessionId;
const RUN_ID = 'run-xyz' as ProviderRunId;
const NOW = '2026-05-07T00:00:00.000Z' as IsoDateTime;

const buildIdleSession = (id: SessionId, wsId: WorkspaceId): Session =>
  buildStorySession({
    id,
    workspaceId: wsId,
    goal: 'test',
    state: { kind: 'idle', lastActivityAt: NOW },
  });

const buildRunningSession = (id: SessionId, wsId: WorkspaceId, runId: ProviderRunId): Session =>
  buildStorySession({
    id,
    workspaceId: wsId,
    goal: 'test',
    state: { kind: 'running', runId, startedAt: NOW },
  });

type StoreModule = typeof import('./store');
let useAppStore: StoreModule['useAppStore'];

beforeAll(async () => {
  ({ useAppStore } = await import('./store'));
}, 60_000);

describe('setCurrentWorkspace, session-scoped state cleanup', () => {
  beforeEach(() => {
    resetStorySpies();
  });

  it('clears all per-session maps when switching workspaces (no active turn)', async () => {
    useAppStore.setState({
      sessions: [buildIdleSession(SESSION_IDLE, WS_A)],
      currentWorkspaceId: WS_A,
      currentSessionId: SESSION_IDLE,
      transcripts: { [SESSION_IDLE]: [] },
      messages: { [SESSION_IDLE]: [] },
      sessionTelemetry: { [SESSION_IDLE]: [] },
      sessionSlots: { [SESSION_IDLE]: [] },
      sessionWorktrees: { [SESSION_IDLE]: ['/tmp/wt'] },
      sessionPhaseRuns: { [SESSION_IDLE]: [] },
      sessionBudgets: { [SESSION_IDLE]: { softCapUsd: 10 } as never },
      summarizerStatus: {
        [SESSION_IDLE]: {
          status: 'idle',
          lastUpdate: null,
          error: null,
          lastUsage: null,
          lastAttempt: null,
        },
      },
      budgetAlerts: [{ id: 'alert-1' } as never],
    });

    await useAppStore.getState().setCurrentWorkspace(WS_B);

    const state = useAppStore.getState();
    expect(state.transcripts).toEqual({});
    expect(state.messages).toEqual({});
    expect(state.sessionTelemetry).toEqual({});
    expect(state.sessionSlots).toEqual({});
    expect(state.sessionWorktrees).toEqual({});
    expect(state.sessionPhaseRuns).toEqual({});
    expect(state.sessionBudgets).toEqual({});
    expect(state.summarizerStatus).toEqual({});
    expect(state.budgetAlerts).toEqual([]);
    expect(state.currentSessionId).toBeNull();
    expect(state.currentWorkspaceId).toBe(WS_B);
  });

  it('calls cancelTurn for every running session before clearing state', async () => {
    useAppStore.setState({
      sessions: [
        buildIdleSession(SESSION_IDLE, WS_A),
        buildRunningSession(SESSION_RUNNING, WS_A, RUN_ID),
      ],
      currentWorkspaceId: WS_A,
      transcripts: {
        [SESSION_IDLE]: [],
        [SESSION_RUNNING]: [],
      },
      messages: {},
      sessionTelemetry: {},
      sessionSlots: {},
      sessionWorktrees: {},
      sessionPhaseRuns: {},
      sessionBudgets: {},
      summarizerStatus: {},
      budgetAlerts: [],
    });

    await useAppStore.getState().setCurrentWorkspace(WS_B);

    expect(storySpies.cancelTurn).toHaveBeenCalledTimes(1);
    expect(storySpies.cancelTurn).toHaveBeenCalledWith(RUN_ID);

    const state = useAppStore.getState();
    expect(state.transcripts).toEqual({});
    expect(state.messages).toEqual({});
  });

  it('does not call cancelTurn when no sessions are running', async () => {
    useAppStore.setState({
      sessions: [buildIdleSession(SESSION_IDLE, WS_A)],
      currentWorkspaceId: WS_A,
      transcripts: {},
      messages: {},
      sessionTelemetry: {},
      sessionSlots: {},
      sessionWorktrees: {},
      sessionPhaseRuns: {},
      sessionBudgets: {},
      summarizerStatus: {},
      budgetAlerts: [],
    });

    await useAppStore.getState().setCurrentWorkspace(WS_B);

    expect(storySpies.cancelTurn).not.toHaveBeenCalled();
  });

  it('loads budget alerts when a workspace becomes current', async () => {
    const alert = {
      id: 'alert-loaded',
      kind: 'provider-threshold',
      provider: 'anthropic',
      currentUsd: 8,
      capUsd: 10,
      createdAt: NOW,
    } satisfies BudgetAlert;
    storySpies.invokeBudgetAlertsList.mockResolvedValue([alert] as never);

    await useAppStore.getState().setCurrentWorkspace(WS_B);

    await vi.waitFor(() => {
      expect(useAppStore.getState().budgetAlerts).toEqual([alert]);
    });
    expect(storySpies.invokeBudgetAlertsList).toHaveBeenCalledOnce();
  });
});
