import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';

// Module mocks — hoisted before store import.
const cancelTurnSpy = vi.fn();

vi.mock('../features/chat/turn', () => ({
  runTurn: vi.fn(async function* () {}),
  cancelTurn: cancelTurnSpy,
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

const removeWorktreeSpy = vi.fn();
const deleteWorktreesForSessionSpy = vi.fn();
const updateSessionStateSpy = vi.fn();

vi.mock('../features/worktree/worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: (repoPath: string, worktreePath: string) =>
    removeWorktreeSpy(repoPath, worktreePath),
}));

vi.mock('../features/permissions/permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionAuditInsert: vi.fn(async () => ({})),
  invokeAuditRetryEnqueue: vi.fn(async () => undefined),
  invokeAuditRetryDrain: vi.fn(async () => []),
  invokeAuditRetryUpdate: vi.fn(async () => undefined),
  invokeAuditRetryDelete: vi.fn(async () => undefined),
  useEffectivePermissionRules: () => [],
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('../shared/lib/db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('@goodboy/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(),
  insertSession: vi.fn(),
  insertSessionWorktree: vi.fn(),
  insertTelemetry: vi.fn(),
  insertWorkspace: vi.fn(),
  listContextSlotsForSession: vi.fn(async () => []),
  listMessagesForSession: vi.fn(async () => []),
  listSessionsForWorkspace: vi.fn(async () => []),
  listTelemetryForSession: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => []),
  listWorktreesForTask: vi.fn(async () => []),
  deleteWorktreesForSession: (db: unknown, id: string) => deleteWorktreesForSessionSpy(db, id),
  setSetting: vi.fn(),
  summarizeSessionTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  updateProviderRunStatus: vi.fn(),
  updateSessionState: (...args: unknown[]) => updateSessionStateSpy(...args),
  upsertContextSlot: vi.fn(),
  insertOpenQuestion: vi.fn(async () => undefined),
  markOpenQuestionsResolvedByText: vi.fn(async () => 0),
  insertTurnEvent: vi.fn(async () => undefined),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForTask: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
  insertNotification: vi.fn(async () => undefined),
  listNotifications: vi.fn(async () => []),
  markAllNotificationsRead: vi.fn(async () => undefined),
  clearAllNotifications: vi.fn(async () => undefined),
  updateSessionWorkflowStep: vi.fn(),
  attachWorkflowToSession: vi.fn(),
  detachWorkflowFromSession: vi.fn(),
  updateWorkflowOrder: vi.fn(),
}));

vi.mock('../features/providers/providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../features/providers/routing', () => ({
  resolveProviderForTurn: vi.fn(async () => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-3-5-sonnet-latest',
    reason: 'preference',
  })),
}));

vi.mock('../features/budget/budget', () => ({
  invokeBudgetRuleList: vi.fn(async () => []),
  invokeBudgetRuleUpsert: vi.fn(),
  invokeBudgetRuleDelete: vi.fn(),
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetAlertDismiss: vi.fn(),
  invokeSessionBudgetGet: vi.fn(),
  invokeSessionBudgetSet: vi.fn(),
}));

vi.mock('../features/skills/skills', () => ({
  invokeSkillList: vi.fn(async () => []),
  invokeSkillUpsert: vi.fn(),
  invokeSkillDelete: vi.fn(),
  invokeSkillRescan: vi.fn(),
  resolveSkillInvocation: vi.fn(),
}));

vi.mock('../features/phases/phases', () => ({
  invokePhaseTemplateList: vi.fn(async () => []),
  invokePhaseTemplateUpsert: vi.fn(),
  invokePhaseTemplateDelete: vi.fn(),
  invokePhaseRunList: vi.fn(async () => []),
  invokePhaseRunInsert: vi.fn(),
  invokePhaseRunUpdateStatus: vi.fn(),
}));

vi.mock('../shared/lib/repo', () => ({
  validateGitRepo: vi.fn(),
}));

vi.mock('../features/providers/provider-pricing', () => ({
  parseProviderPricingConfig: vi.fn(() => null),
  getCodexPriceOverride: vi.fn(() => null),
  refreshPricingTable: vi.fn(() => Promise.resolve()),
}));

const SESSION_ID = 'session-end-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const NOW: IsoDateTime = '2026-05-08T00:00:00.000Z' as IsoDateTime;
const WORKTREE_PATH = '/tmp/wt-end';
const REPO_PATH = '/tmp/repo';

function buildSession(stateKind: 'idle' | 'running' = 'idle'): Session {
  const state =
    stateKind === 'running'
      ? {
          kind: 'running' as const,
          runId: 'run-1' as import('@goodboy/types').ProviderRunId,
          startedAt: NOW,
        }
      : { kind: 'idle' as const, lastActivityAt: NOW };
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test end session',
    state,
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    workflowIds: [],
    currentStepByWorkflow: {},
    userStatus: 'wip',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function importStore() {
  const mod = await import('./store');
  return mod.useAppStore;
}

describe('endSession — happy path', () => {
  beforeEach(() => {
    removeWorktreeSpy.mockReset();
    deleteWorktreesForSessionSpy.mockReset();
    updateSessionStateSpy.mockReset();
    cancelTurnSpy.mockReset();

    removeWorktreeSpy.mockResolvedValue(undefined);
    deleteWorktreesForSessionSpy.mockResolvedValue(undefined);
    updateSessionStateSpy.mockResolvedValue(undefined);
    cancelTurnSpy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('marks session ended when session has no turns (empty)', async () => {
    const useAppStore = await importStore();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: [WORKTREE_PATH] },
      workspaces: [
        { id: WORKSPACE_ID, name: 'ws', rootPath: REPO_PATH, createdAt: NOW, updatedAt: NOW },
      ],
    });

    await useAppStore.getState().endSession(SESSION_ID);

    const session = useAppStore.getState().sessions.find((s) => s.id === SESSION_ID);
    expect(session?.state.kind).toBe('ended');
    expect(updateSessionStateSpy).toHaveBeenCalledOnce();
  });

  it('marks session ended when session has persisted turns (non-empty)', async () => {
    const useAppStore = await importStore();
    useAppStore.setState({
      sessions: [buildSession('idle')],
      sessionWorktrees: { [SESSION_ID]: [WORKTREE_PATH] },
      workspaces: [
        { id: WORKSPACE_ID, name: 'ws', rootPath: REPO_PATH, createdAt: NOW, updatedAt: NOW },
      ],
      transcripts: {
        [SESSION_ID]: [
          {
            kind: 'assistant_text',
            runId: 'run-1' as import('@goodboy/types').ProviderRunId,
            delta: 'hello',
            at: NOW,
          },
        ],
      },
    });

    await useAppStore.getState().endSession(SESSION_ID);

    const session = useAppStore.getState().sessions.find((s) => s.id === SESSION_ID);
    expect(session?.state.kind).toBe('ended');
  });

  it('removes worktree paths from state after end', async () => {
    const useAppStore = await importStore();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: [WORKTREE_PATH] },
      workspaces: [
        { id: WORKSPACE_ID, name: 'ws', rootPath: REPO_PATH, createdAt: NOW, updatedAt: NOW },
      ],
    });

    await useAppStore.getState().endSession(SESSION_ID);

    expect(useAppStore.getState().sessionWorktrees[SESSION_ID]).toBeUndefined();
  });

  it('calls removeWorktree for each worktree path', async () => {
    const useAppStore = await importStore();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: [WORKTREE_PATH, '/tmp/wt-2'] },
      workspaces: [
        { id: WORKSPACE_ID, name: 'ws', rootPath: REPO_PATH, createdAt: NOW, updatedAt: NOW },
      ],
    });

    await useAppStore.getState().endSession(SESSION_ID);

    expect(removeWorktreeSpy).toHaveBeenCalledTimes(2);
  });

  it('cancels running turn before ending', async () => {
    const useAppStore = await importStore();
    useAppStore.setState({
      sessions: [buildSession('running')],
      sessionWorktrees: { [SESSION_ID]: [WORKTREE_PATH] },
      workspaces: [
        { id: WORKSPACE_ID, name: 'ws', rootPath: REPO_PATH, createdAt: NOW, updatedAt: NOW },
      ],
    });

    await useAppStore.getState().endSession(SESSION_ID);

    expect(cancelTurnSpy).toHaveBeenCalledWith('run-1');
  });
});

describe('endSession — Tauri error propagation (#242)', () => {
  beforeEach(() => {
    removeWorktreeSpy.mockReset();
    deleteWorktreesForSessionSpy.mockReset();
    updateSessionStateSpy.mockReset();
    cancelTurnSpy.mockReset();

    removeWorktreeSpy.mockResolvedValue(undefined);
    deleteWorktreesForSessionSpy.mockResolvedValue(undefined);
    updateSessionStateSpy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('continues ending session when removeWorktree throws (worktree may be gone)', async () => {
    // removeWorktree failure must not abort endSession — it's best-effort.
    removeWorktreeSpy.mockRejectedValue(new Error('worktree not found'));

    const useAppStore = await importStore();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: [WORKTREE_PATH] },
      workspaces: [
        { id: WORKSPACE_ID, name: 'ws', rootPath: REPO_PATH, createdAt: NOW, updatedAt: NOW },
      ],
    });

    await expect(useAppStore.getState().endSession(SESSION_ID)).resolves.toBeUndefined();

    const session = useAppStore.getState().sessions.find((s) => s.id === SESSION_ID);
    expect(session?.state.kind).toBe('ended');
  });

  it('propagates error from updateSessionState as structured message', async () => {
    // Simulate a Tauri-style JSON error object (not instanceof Error)
    const tauriErr = { kind: 'db', message: 'database is locked' };
    updateSessionStateSpy.mockRejectedValue(tauriErr);

    const useAppStore = await importStore();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: [WORKTREE_PATH] },
      workspaces: [
        { id: WORKSPACE_ID, name: 'ws', rootPath: REPO_PATH, createdAt: NOW, updatedAt: NOW },
      ],
    });

    // endSession should throw — the caller (EndSessionDialog) will handle it
    await expect(useAppStore.getState().endSession(SESSION_ID)).rejects.toMatchObject({
      message: 'database is locked',
    });
  });
});
