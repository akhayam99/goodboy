import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Session, SessionId, Task, TaskId, WorkspaceId } from '@kay-am/types';

vi.mock('../turn', () => ({
  runTurn: vi.fn(),
  cancelTurn: vi.fn(),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

vi.mock('../permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionAuditInsert: vi.fn(),
  useEffectivePermissionRules: () => [],
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

vi.mock('../db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('@kay-am/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(),
  insertTask: vi.fn(),
  insertTelemetry: vi.fn(),
  insertWorkspace: vi.fn(),
  listContextSlotsForTask: vi.fn(async () => []),
  listMessagesForTask: vi.fn(async () => []),
  listTasksForWorkspace: vi.fn(async () => []),
  listTelemetryForTask: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => []),
  setSetting: vi.fn(),
  summarizeTaskTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  updateProviderRunStatus: vi.fn(),
  updateTaskState: vi.fn(),
  upsertContextSlot: vi.fn(),
  insertTurnEvent: vi.fn(async () => undefined),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForTask: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
  listAgentRunIdsForTask: vi.fn(async () => new Map()),
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

vi.mock('../routing', () => ({ resolveProviderForTurn: vi.fn() }));

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

const phaseRunListMock = vi.fn(async () => [] as ReadonlyArray<Session>);

vi.mock('../phases', () => ({
  invokePhaseTemplateList: vi.fn(async () => []),
  invokePhaseTemplateUpsert: vi.fn(),
  invokePhaseTemplateDelete: vi.fn(),
  invokePhaseRunList: phaseRunListMock,
  invokePhaseRunInsert: vi.fn(),
  invokePhaseRunUpdateStatus: vi.fn(),
}));

vi.mock('../worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
}));

vi.mock('../repo', () => ({ validateGitRepo: vi.fn() }));

const WS_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 'session-1' as TaskId;
const NOW = '2026-05-14T12:00:00.000Z' as IsoDateTime;

function buildSession(): Task {
  return {
    id: SESSION_ID,
    workspaceId: WS_ID,
    goal: 'reopen test',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions',
    autoRun: false,
    titleUserEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
  } as Task;
}

function buildAgent(id: string, ordinal: number): Session {
  return {
    id: id as SessionId,
    taskId: SESSION_ID,
    workflowStepId: null,
    ordinal,
    name: `agent ${ordinal}`,
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    status: 'idle',
    runId: null,
    startedAt: null,
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  } as unknown as Session;
}

describe('setCurrentSession — default agent fallback', () => {
  beforeEach(() => {
    phaseRunListMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function importStore() {
    const mod = await import('./store');
    return mod.useAppStore;
  }

  it('selects the highest-ordinal agent when nothing is previously selected', async () => {
    const useAppStore = await importStore();
    const agents = [buildAgent('a1', 1), buildAgent('a2', 2), buildAgent('a3', 3)];
    phaseRunListMock.mockResolvedValueOnce(agents);

    useAppStore.setState({
      sessions: [buildSession()],
      currentWorkspaceId: WS_ID,
      selectedAgentId: {},
    });

    await useAppStore.getState().setCurrentSession(SESSION_ID);

    expect(useAppStore.getState().selectedAgentId[SESSION_ID]).toBe('a3');
  });

  it('selects the highest-ordinal agent regardless of input order', async () => {
    const useAppStore = await importStore();
    // intentionally shuffled
    const agents = [buildAgent('a3', 3), buildAgent('a1', 1), buildAgent('a2', 2)];
    phaseRunListMock.mockResolvedValueOnce(agents);

    useAppStore.setState({
      sessions: [buildSession()],
      currentWorkspaceId: WS_ID,
      selectedAgentId: {},
    });

    await useAppStore.getState().setCurrentSession(SESSION_ID);

    expect(useAppStore.getState().selectedAgentId[SESSION_ID]).toBe('a3');
  });

  it('honours a still-valid previously selected agent', async () => {
    const useAppStore = await importStore();
    const agents = [buildAgent('a1', 1), buildAgent('a2', 2), buildAgent('a3', 3)];
    phaseRunListMock.mockResolvedValueOnce(agents);

    useAppStore.setState({
      sessions: [buildSession()],
      currentWorkspaceId: WS_ID,
      selectedAgentId: { [SESSION_ID]: 'a2' as SessionId },
    });

    await useAppStore.getState().setCurrentSession(SESSION_ID);

    expect(useAppStore.getState().selectedAgentId[SESSION_ID]).toBe('a2');
  });

  it('falls back to the highest-ordinal agent when the previously selected one is gone', async () => {
    const useAppStore = await importStore();
    const agents = [buildAgent('a1', 1), buildAgent('a3', 3)];
    phaseRunListMock.mockResolvedValueOnce(agents);

    useAppStore.setState({
      sessions: [buildSession()],
      currentWorkspaceId: WS_ID,
      selectedAgentId: { [SESSION_ID]: 'a2' as SessionId },
    });

    await useAppStore.getState().setCurrentSession(SESSION_ID);

    expect(useAppStore.getState().selectedAgentId[SESSION_ID]).toBe('a3');
  });

  it('sets selectedAgentId to null when there are no agents at all', async () => {
    const useAppStore = await importStore();
    phaseRunListMock.mockResolvedValueOnce([]);

    useAppStore.setState({
      sessions: [buildSession()],
      currentWorkspaceId: WS_ID,
      selectedAgentId: {},
    });

    await useAppStore.getState().setCurrentSession(SESSION_ID);

    expect(useAppStore.getState().selectedAgentId[SESSION_ID]).toBeNull();
  });
});
