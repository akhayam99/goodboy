import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  PermissionRule,
  PermissionRuleId,
  ProviderRunId,
  Session,
  SessionId,
  Task,
  TaskId,
  TurnEvent,
  WorkspaceId,
} from '@kay-am/types';

// ---------------------------------------------------------------------------
// Module mocks — these MUST be hoisted before importing the store
// ---------------------------------------------------------------------------

const runTurnSpy = vi.fn();
const cancelTurnSpy = vi.fn();

vi.mock('../turn', () => ({
  runTurn: (args: unknown) => runTurnSpy(args),
  cancelTurn: cancelTurnSpy,
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

const permissionRuleListSpy = vi.fn();
const permissionAuditInsertSpy = vi.fn();

vi.mock('../permissions', () => ({
  invokePermissionRuleList: (args: unknown) => permissionRuleListSpy(args),
  invokePermissionAuditInsert: (args: unknown) => permissionAuditInsertSpy(args),
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

vi.mock('../db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('@kay-am/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(),
  insertTask: vi.fn(),
  insertTaskWorktree: vi.fn(),
  insertTelemetry: vi.fn(),
  insertWorkspace: vi.fn(),
  listContextSlotsForTask: vi.fn(async () => []),
  listMessagesForTask: vi.fn(async () => []),
  listTasksForWorkspace: vi.fn(async () => []),
  listTelemetryForTask: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => []),
  listWorktreesForTask: vi.fn(async () => []),
  deleteWorktreesForTask: vi.fn(),
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
  insertNotification: vi.fn(async () => undefined),
  listNotifications: vi.fn(async () => []),
  markAllNotificationsRead: vi.fn(async () => undefined),
  clearAllNotifications: vi.fn(async () => undefined),
}));

vi.mock('../providers', () => ({
  buildProviderList: () => [
    { id: 'anthropic', binary: 'claude', connection: 'connected' },
    { id: 'cursor', binary: 'cursor-agent', connection: 'connected' },
  ],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../routing', () => ({
  resolveProviderForTurn: vi.fn(async (_pref, _override, _connected) => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-3-5-sonnet-latest',
    reason: 'preference',
  })),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_ID = 'session-1' as TaskId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

function buildSession(): Task {
  const now = '2026-05-07T00:00:00.000Z' as IsoDateTime;
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test',
    state: { kind: 'idle', lastActivityAt: now },
    contextSlots: [],
    providerPreference: {
      defaultProvider: 'anthropic',
      allowTurnOverride: false,
    },
    permissionMode: 'bypassPermissions',
    autoRun: false,
    titleUserEdited: false,
    createdAt: now,
    updatedAt: now,
  };
}

function buildRule(overrides: Partial<PermissionRule>): PermissionRule {
  const now = '2026-05-07T00:00:00.000Z' as IsoDateTime;
  return {
    id: 'rule-1' as PermissionRuleId,
    scope: 'task',
    taskId: SESSION_ID,
    pattern: { tool: 'Edit' },
    decision: 'allow',
    priority: 100,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function* emptyStream(): AsyncIterable<TurnEvent> {
  // emit nothing — turn ends immediately
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendTurn — permission proxy integration', () => {
  beforeEach(async () => {
    runTurnSpy.mockReset();
    cancelTurnSpy.mockReset();
    permissionRuleListSpy.mockReset();
    permissionAuditInsertSpy.mockReset();
    runTurnSpy.mockImplementation(() => emptyStream());
    permissionRuleListSpy.mockResolvedValue([]);
    const routingMod = await import('../routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockReset();
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-3-5-sonnet-latest',
      reason: 'preference',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function importStore() {
    const mod = await import('./store');
    return mod.useAppStore;
  }

  function setupSession(useAppStore: Awaited<ReturnType<typeof importStore>>) {
    const defaultAgent: Session = {
      id: 'agent-1' as SessionId,
      taskId: SESSION_ID,
      ordinal: 0,
      name: 'agent 1',
      status: 'pending',
    };
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionPhaseRuns: { [SESSION_ID]: [defaultAgent] },
      selectedAgentId: { [SESSION_ID]: defaultAgent.id },
      providers: [
        {
          id: 'anthropic',
          binary: 'claude',
          connection: 'connected',
          name: 'Claude',
          installation: 'installed',
        } as never,
      ],
      authResults: {
        anthropic: { state: 'connected', identity: 'test' },
        cursor: { state: 'connected', identity: 'test' },
        codex: { state: 'connected', identity: 'test' },
      } as never,
      workspaces: [
        {
          id: WORKSPACE_ID,
          name: 'ws',
          rootPath: '/tmp',
          createdAt: '2026-05-07T00:00:00.000Z' as IsoDateTime,
          updatedAt: '2026-05-07T00:00:00.000Z' as IsoDateTime,
        },
      ],
    });
  }

  it('forwards disallowedTools when a deny rule is configured (claude)', async () => {
    permissionRuleListSpy.mockImplementation(async (args: { scope: string }) => {
      if (args.scope === 'task') {
        return [
          buildRule({
            decision: 'deny',
            pattern: { tool: 'Bash', argsMatcher: 'rm:*' },
          }),
        ];
      }
      return [];
    });

    const useAppStore = await importStore();
    setupSession(useAppStore);
    await useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'hello' });

    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    const args = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.disallowedTools).toEqual(['Bash(rm:*)']);
    expect(args.allowedTools).toEqual([]);
    expect(args.permissionMode).toBe('bypassPermissions');
  });

  it('forwards allowedTools when an allow rule is configured (claude)', async () => {
    permissionRuleListSpy.mockImplementation(async (args: { scope: string }) => {
      if (args.scope === 'task') {
        return [buildRule({ decision: 'allow', pattern: { tool: 'Edit' } })];
      }
      return [];
    });

    const useAppStore = await importStore();
    setupSession(useAppStore);
    await useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'hi' });

    const args = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.allowedTools).toEqual(['Edit']);
    expect(args.disallowedTools).toEqual([]);
  });

  it('forwards empty tool lists with default mode when no rules exist (claude)', async () => {
    permissionRuleListSpy.mockResolvedValue([]);

    const useAppStore = await importStore();
    setupSession(useAppStore);
    await useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'hi' });

    const args = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.allowedTools).toEqual([]);
    expect(args.disallowedTools).toEqual([]);
    expect(args.permissionMode).toBe('bypassPermissions');
    // regression guard: never carry the legacy bypass flag through the JS payload
    expect(JSON.stringify(args)).not.toContain('dangerously-skip-permissions');
  });

  it('does NOT forward permission flags when provider is cursor', async () => {
    const routingMod = await import('../routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      selectedProvider: 'cursor',
      selectedModel: 'cursor-default',
      reason: 'preference',
    });

    const useAppStore = await importStore();
    setupSession(useAppStore);
    await useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'hi' });

    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    const args = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.allowedTools).toBeUndefined();
    expect(args.disallowedTools).toBeUndefined();
    expect(args.permissionMode).toBeUndefined();
    expect(permissionRuleListSpy).not.toHaveBeenCalled();
  });
});
