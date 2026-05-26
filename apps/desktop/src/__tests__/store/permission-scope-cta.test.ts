import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId, WorkspaceId } from '@goodboy/types';

// Module mocks — hoisted before store import.
vi.mock('../../turn', () => ({
  runTurn: vi.fn(),
  cancelTurn: vi.fn(),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

const permissionRuleUpsertSpy = vi.fn();

vi.mock('../../features/permissions/permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionRuleUpsert: (...args: unknown[]) => permissionRuleUpsertSpy(...args),
  invokePermissionAuditInsert: vi.fn(async () => undefined),
  invokeAuditRetryEnqueue: vi.fn(async () => undefined),
  invokeAuditRetryDrain: vi.fn(async () => []),
  invokeAuditRetryUpdate: vi.fn(async () => undefined),
  invokeAuditRetryDelete: vi.fn(async () => undefined),
  useEffectivePermissionRules: () => [],
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

vi.mock('../../shared/lib/db', () => ({
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
  deleteWorktreesForSession: vi.fn(),
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
  updateSessionWorkflowStep: vi.fn(),
  attachWorkflowToSession: vi.fn(),
  detachWorkflowFromSession: vi.fn(),
  updateWorkflowOrder: vi.fn(),
}));

vi.mock('../../providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../../routing', () => ({
  resolveProviderForTurn: vi.fn(async () => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-opus-4-7',
    reason: 'preference',
  })),
}));

vi.mock('../../features/budget/budget', () => ({
  invokeBudgetRuleList: vi.fn(async () => []),
  invokeBudgetRuleUpsert: vi.fn(),
  invokeBudgetRuleDelete: vi.fn(),
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetAlertDismiss: vi.fn(),
  invokeSessionBudgetGet: vi.fn(),
  invokeSessionBudgetSet: vi.fn(),
  invokeCheckProviderBudget: vi.fn(),
}));

vi.mock('../../features/skills/skills', () => ({
  invokeSkillList: vi.fn(async () => []),
  invokeSkillUpsert: vi.fn(),
  invokeSkillDelete: vi.fn(),
  invokeSkillRescan: vi.fn(),
  resolveSkillInvocation: vi.fn(),
}));

vi.mock('../../features/phases/phases', () => ({
  invokePhaseTemplateList: vi.fn(async () => []),
  invokePhaseTemplateUpsert: vi.fn(),
  invokePhaseTemplateDelete: vi.fn(),
  invokePhaseRunList: vi.fn(async () => []),
  invokePhaseRunInsert: vi.fn(),
  invokePhaseRunUpdateStatus: vi.fn(),
}));

vi.mock('../../features/worktree/worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
}));

vi.mock('../../shared/lib/repo', () => ({ validateGitRepo: vi.fn() }));

vi.mock('../../provider-pricing', () => ({
  parseProviderPricingConfig: vi.fn(() => null),
  getCodexPriceOverride: vi.fn(() => null),
  refreshPricingTable: vi.fn(() => Promise.resolve()),
}));

const SESSION_ID = 'sess-1' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;
const AT: IsoDateTime = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const TOOL_USE_ID = 'tu-abc';
const TOOL_NAME = 'Bash';

function buildSession() {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test',
    state: { kind: 'idle' as const, lastActivityAt: AT },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic' as const, allowTurnOverride: false },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    workflowIds: [],
    currentStepByWorkflow: {},
    userStatus: 'wip' as const,
    createdAt: AT,
    updatedAt: AT,
  };
}

describe('resolvePermissionRequest', () => {
  let useAppStore: (typeof import('../../store/store'))['useAppStore'];

  beforeEach(async () => {
    vi.resetModules();
    permissionRuleUpsertSpy.mockReset();
    permissionRuleUpsertSpy.mockResolvedValue({
      id: 'rule-new',
      scope: 'session',
      pattern: { tool: TOOL_NAME },
      decision: 'allow',
      priority: 100,
      createdAt: AT,
      updatedAt: AT,
    });
    ({ useAppStore } = await import('../../store/store'));
    useAppStore.setState({ sessions: [buildSession()] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const call = (
    store: ReturnType<typeof useAppStore.getState>,
    scope: 'global' | 'workspace' | 'session' | 'once' | 'deny',
  ) =>
    store.resolvePermissionRequest({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolUseId: TOOL_USE_ID,
      toolName: TOOL_NAME,
      runId: RUN_ID,
      scope,
    });

  it('approve global — upserts rule with scope global, decision allow', async () => {
    await call(useAppStore.getState(), 'global');
    expect(permissionRuleUpsertSpy).toHaveBeenCalledOnce();
    const arg = (permissionRuleUpsertSpy.mock.calls as unknown as [unknown[]])[0]![0] as Record<
      string,
      unknown
    >;
    expect(arg.scope).toBe('global');
    expect(arg.decision).toBe('allow');
    expect(arg.patternTool).toBe(TOOL_NAME);
    expect(arg.workspaceId).toBeUndefined();
    expect(arg.sessionId).toBeUndefined();
  });

  it('approve workspace — upserts rule with scope workspace + workspaceId', async () => {
    await call(useAppStore.getState(), 'workspace');
    expect(permissionRuleUpsertSpy).toHaveBeenCalledOnce();
    const arg = (permissionRuleUpsertSpy.mock.calls as unknown as [unknown[]])[0]![0] as Record<
      string,
      unknown
    >;
    expect(arg.scope).toBe('workspace');
    expect(arg.decision).toBe('allow');
    expect(arg.workspaceId).toBe(WORKSPACE_ID);
    expect(arg.sessionId).toBeUndefined();
  });

  it('approve session — upserts rule with scope task + sessionId', async () => {
    await call(useAppStore.getState(), 'session');
    expect(permissionRuleUpsertSpy).toHaveBeenCalledOnce();
    const arg = (permissionRuleUpsertSpy.mock.calls as unknown as [unknown[]])[0]![0] as Record<
      string,
      unknown
    >;
    expect(arg.scope).toBe('session');
    expect(arg.decision).toBe('allow');
    expect(arg.sessionId).toBe(SESSION_ID);
    expect(arg.workspaceId).toBeUndefined();
  });

  it('approve once — does NOT call upsert, adds toolUseId to volatilePermissionAllows', async () => {
    await call(useAppStore.getState(), 'once');
    expect(permissionRuleUpsertSpy).not.toHaveBeenCalled();
    const volatile = useAppStore.getState().volatilePermissionAllows;
    expect(volatile.has(TOOL_USE_ID)).toBe(true);
  });

  it('deny — upserts deny rule with scope task + sessionId', async () => {
    await call(useAppStore.getState(), 'deny');
    expect(permissionRuleUpsertSpy).toHaveBeenCalledOnce();
    const arg = (permissionRuleUpsertSpy.mock.calls as unknown as [unknown[]])[0]![0] as Record<
      string,
      unknown
    >;
    expect(arg.scope).toBe('session');
    expect(arg.decision).toBe('deny');
    expect(arg.sessionId).toBe(SESSION_ID);
  });

  it('each scope appends a permission_decision TurnEvent', async () => {
    for (const scope of ['global', 'workspace', 'session', 'once', 'deny'] as const) {
      vi.resetModules();
      permissionRuleUpsertSpy.mockReset();
      permissionRuleUpsertSpy.mockResolvedValue({
        id: 'rule-new',
        scope: 'session',
        pattern: { tool: TOOL_NAME },
        decision: 'allow',
        priority: 100,
        createdAt: AT,
        updatedAt: AT,
      });
      ({ useAppStore } = await import('../../store/store'));
      useAppStore.setState({ sessions: [buildSession()] });

      await call(useAppStore.getState(), scope);
      const events = useAppStore.getState().transcripts[AGENT_ID] ?? [];
      const decEv = events.find((e) => e.kind === 'permission_decision');
      expect(decEv, `scope ${scope} missing permission_decision event`).toBeDefined();
      if (!decEv || decEv.kind !== 'permission_decision') continue;
      expect(decEv.decidedBy).toBe('user');
      expect(decEv.decision).toBe(scope === 'deny' ? 'deny' : 'allow');
    }
  });
});
