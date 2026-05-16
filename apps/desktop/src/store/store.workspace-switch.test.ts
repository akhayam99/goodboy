import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId, Session, SessionId, WorkspaceId } from '@kay-am/types';

// Module mocks — hoisted before store import.
const cancelTurnSpy = vi.fn();

vi.mock('../turn', () => ({
  runTurn: vi.fn(),
  cancelTurn: cancelTurnSpy,
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

vi.mock('../permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionAuditInsert: vi.fn(),
  useEffectivePermissionRules: () => [],
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('../db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('@kay-am/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(),
  insertSession: vi.fn(),
  insertTelemetry: vi.fn(),
  insertWorkspace: vi.fn(),
  listContextSlotsForSession: vi.fn(async () => []),
  listMessagesForSession: vi.fn(async () => []),
  listSessionsForWorkspace: vi.fn(async () => []),
  listTelemetryForSession: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => []),
  setSetting: vi.fn(),
  summarizeSessionTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  updateProviderRunStatus: vi.fn(),
  updateSessionState: vi.fn(),
  upsertContextSlot: vi.fn(),
  insertTurnEvent: vi.fn(async () => undefined),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForTask: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
  insertNotification: vi.fn(async () => undefined),
  listNotifications: vi.fn(async () => []),
  markAllNotificationsRead: vi.fn(async () => undefined),
  clearAllNotifications: vi.fn(async () => undefined),
}));

vi.mock('../providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../routing', () => ({
  resolveProviderForTurn: vi.fn(),
}));

vi.mock('../budget', () => ({
  invokeBudgetRuleList: vi.fn(async () => []),
  invokeBudgetRuleUpsert: vi.fn(),
  invokeBudgetRuleDelete: vi.fn(),
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetAlertDismiss: vi.fn(),
  invokeSessionBudgetGet: vi.fn(),
  invokeSessionBudgetSet: vi.fn(),
  invokeCheckProviderBudget: vi.fn(),
}));

vi.mock('../skills', () => ({
  invokeSkillList: vi.fn(async () => []),
  invokeSkillUpsert: vi.fn(),
  invokeSkillDelete: vi.fn(),
  invokeSkillRescan: vi.fn(),
  resolveSkillInvocation: vi.fn(),
}));

vi.mock('../phases', () => ({
  invokePhaseTemplateList: vi.fn(async () => []),
  invokePhaseTemplateUpsert: vi.fn(),
  invokePhaseTemplateDelete: vi.fn(),
  invokePhaseRunList: vi.fn(async () => []),
  invokePhaseRunInsert: vi.fn(),
  invokePhaseRunUpdateStatus: vi.fn(),
}));

vi.mock('../worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
}));

vi.mock('../repo', () => ({
  validateGitRepo: vi.fn(),
}));

const WS_A = 'workspace-a' as WorkspaceId;
const WS_B = 'workspace-b' as WorkspaceId;
const SESSION_IDLE = 'session-idle' as SessionId;
const SESSION_RUNNING = 'session-running' as SessionId;
const RUN_ID = 'run-xyz' as ProviderRunId;
const NOW = '2026-05-07T00:00:00.000Z' as IsoDateTime;

function buildIdleSession(id: SessionId, wsId: WorkspaceId): Session {
  return {
    id,
    workspaceId: wsId,
    goal: 'test',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions',
    autoRun: false,
    titleUserEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function buildRunningSession(id: SessionId, wsId: WorkspaceId, runId: ProviderRunId): Session {
  return {
    id,
    workspaceId: wsId,
    goal: 'test',
    state: { kind: 'running', runId, startedAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions',
    autoRun: false,
    titleUserEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('setCurrentWorkspace — session-scoped state cleanup', () => {
  beforeEach(() => {
    cancelTurnSpy.mockReset();
    cancelTurnSpy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function importStore() {
    const mod = await import('./store');
    return mod.useAppStore;
  }

  it('clears all per-session maps when switching workspaces (no active turn)', async () => {
    const useAppStore = await importStore();

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
        [SESSION_IDLE]: { status: 'idle', lastUpdate: null, error: null, lastUsage: null },
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
    const useAppStore = await importStore();

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

    expect(cancelTurnSpy).toHaveBeenCalledTimes(1);
    expect(cancelTurnSpy).toHaveBeenCalledWith(RUN_ID);

    const state = useAppStore.getState();
    expect(state.transcripts).toEqual({});
    expect(state.messages).toEqual({});
  });

  it('does not call cancelTurn when no sessions are running', async () => {
    const useAppStore = await importStore();

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

    expect(cancelTurnSpy).not.toHaveBeenCalled();
  });
});
