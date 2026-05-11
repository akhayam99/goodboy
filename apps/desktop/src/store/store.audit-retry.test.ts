import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  Session,
  SessionId,
  Task,
  TaskId,
  TurnEvent,
  WorkspaceId,
} from '@kay-am/types';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before store import
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
const auditRetryEnqueueSpy = vi.fn();
const auditRetryDrainSpy = vi.fn();
const auditRetryUpdateSpy = vi.fn();
const auditRetryDeleteSpy = vi.fn();

vi.mock('../permissions', () => ({
  invokePermissionRuleList: (args: unknown) => permissionRuleListSpy(args),
  invokePermissionAuditInsert: (args: unknown) => permissionAuditInsertSpy(args),
  invokeAuditRetryEnqueue: (id: string, payload: string) => auditRetryEnqueueSpy(id, payload),
  invokeAuditRetryDrain: (limit: number) => auditRetryDrainSpy(limit),
  invokeAuditRetryUpdate: (id: string, attempts: number, err: string) =>
    auditRetryUpdateSpy(id, attempts, err),
  invokeAuditRetryDelete: (id: string) => auditRetryDeleteSpy(id),
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
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../routing', () => ({
  resolveProviderForTurn: vi.fn(async () => ({
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

vi.mock('../providerPricing', () => ({
  parseProviderPricingConfig: vi.fn(() => null),
  getCodexPriceOverride: vi.fn(() => null),
  refreshPricingTable: vi.fn(() => Promise.resolve()),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_ID = 'session-1' as TaskId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const NOW: IsoDateTime = '2026-05-07T00:00:00.000Z' as IsoDateTime;

function buildSession(): Task {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeRetryEntry(overrides: { id?: string; payloadJson?: string; attempts?: number }) {
  return {
    id: overrides.id ?? 'retry-1',
    payloadJson:
      overrides.payloadJson ??
      JSON.stringify({
        id: 'req-1',
        runId: 'run-1',
        taskId: SESSION_ID,
        toolUseId: 'tu-1',
        toolName: 'Edit',
        inputJson: '{}',
        decision: 'allow',
        decidedBy: 'engine',
        requestedAt: NOW,
        decidedAt: NOW,
      }),
    attempts: overrides.attempts ?? 0,
    lastError: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

async function* emptyStream(): AsyncIterable<TurnEvent> {
  // intentionally empty
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('audit retry queue — sendTurn enqueue on failure', () => {
  beforeEach(() => {
    runTurnSpy.mockReset();
    cancelTurnSpy.mockReset();
    permissionRuleListSpy.mockReset();
    permissionAuditInsertSpy.mockReset();
    auditRetryEnqueueSpy.mockReset();
    auditRetryDrainSpy.mockReset();
    auditRetryUpdateSpy.mockReset();
    auditRetryDeleteSpy.mockReset();

    permissionRuleListSpy.mockResolvedValue([]);
    auditRetryEnqueueSpy.mockResolvedValue(undefined);
    auditRetryDrainSpy.mockResolvedValue([]);
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
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
  }

  it('enqueues to retry queue when audit insert fails', async () => {
    permissionAuditInsertSpy.mockRejectedValue(new Error('db locked'));

    async function* toolStream(): AsyncIterable<TurnEvent> {
      yield {
        kind: 'tool_call_start',
        toolUseId: 'tu-1',
        toolName: 'Edit',
        input: { path: '/tmp/x' },
        at: NOW,
      } as TurnEvent;
    }
    runTurnSpy.mockImplementation(() => toolStream());

    const useAppStore = await importStore();
    setupSession(useAppStore);
    await useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'go' });

    expect(permissionAuditInsertSpy).toHaveBeenCalledTimes(1);
    expect(auditRetryEnqueueSpy).toHaveBeenCalledTimes(1);
    const [enqueuedId, enqueuedPayload] = auditRetryEnqueueSpy.mock.calls[0] as [string, string];
    expect(typeof enqueuedId).toBe('string');
    const parsed = JSON.parse(enqueuedPayload) as Record<string, unknown>;
    expect(parsed.toolName).toBe('Edit');
    // No rules → engine defaults to deny; decision value is whatever the engine decides.
    expect(typeof parsed.decision).toBe('string');
  });

  it('does NOT enqueue when audit insert succeeds', async () => {
    permissionAuditInsertSpy.mockResolvedValue({});

    async function* toolStream(): AsyncIterable<TurnEvent> {
      yield {
        kind: 'tool_call_start',
        toolUseId: 'tu-2',
        toolName: 'Read',
        input: {},
        at: NOW,
      } as TurnEvent;
    }
    runTurnSpy.mockImplementation(() => toolStream());

    const useAppStore = await importStore();
    setupSession(useAppStore);
    await useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'go' });

    expect(auditRetryEnqueueSpy).not.toHaveBeenCalled();
  });
});

describe('audit retry queue — drain worker (happy path)', () => {
  beforeEach(() => {
    runTurnSpy.mockImplementation(() => emptyStream());
    permissionRuleListSpy.mockResolvedValue([]);
    auditRetryEnqueueSpy.mockResolvedValue(undefined);
    auditRetryUpdateSpy.mockResolvedValue(undefined);
    auditRetryDeleteSpy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    auditRetryDrainSpy.mockReset();
    auditRetryDeleteSpy.mockReset();
    auditRetryUpdateSpy.mockReset();
    permissionAuditInsertSpy.mockReset();
  });

  async function runHydrate() {
    const { runDbMigrations } = await import('../db');
    (runDbMigrations as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const { getSetting } = await import('@kay-am/db');
    (getSetting as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { getProviderStatus, getCursorStatus, getCodexStatus, checkProviderAuth } =
      await import('../providers');
    (getProviderStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'connected',
      identity: 'test',
    });
    (getCursorStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'connected',
      identity: 'test',
    });
    (getCodexStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'connected',
      identity: 'test',
    });
    (checkProviderAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'connected',
      identity: 'test',
    });

    const mod = await import('./store');
    await mod.useAppStore.getState().hydrate();
    // Drain is fired with void — yield microtask so it can settle.
    await Promise.resolve();
  }

  it('drain happy path: retries insert, deletes on success', async () => {
    // updatedAt=0 so backoff (4000ms for attempts=2) is satisfied.
    const entry = { ...makeRetryEntry({ id: 'retry-happy', attempts: 2 }), updatedAt: 0 };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    permissionAuditInsertSpy.mockResolvedValue({});

    await runHydrate();

    expect(auditRetryDrainSpy).toHaveBeenCalledWith(50);
    expect(permissionAuditInsertSpy).toHaveBeenCalledTimes(1);
    expect(auditRetryDeleteSpy).toHaveBeenCalledWith('retry-happy');
    expect(auditRetryUpdateSpy).not.toHaveBeenCalled();
  });

  it('drain failure path: increments attempts when insert still fails', async () => {
    // updatedAt=0 so backoff is satisfied.
    const entry = { ...makeRetryEntry({ id: 'retry-fail', attempts: 3 }), updatedAt: 0 };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    permissionAuditInsertSpy.mockRejectedValue(new Error('still locked'));

    await runHydrate();

    expect(auditRetryUpdateSpy).toHaveBeenCalledWith('retry-fail', 4, 'still locked');
    expect(auditRetryDeleteSpy).not.toHaveBeenCalled();
  });

  it('max-attempts boundary: deletes entry at attempt 5', async () => {
    // updatedAt in the past so backoff is satisfied.
    const entry = { ...makeRetryEntry({ id: 'retry-max', attempts: 4 }), updatedAt: 0 };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    permissionAuditInsertSpy.mockRejectedValue(new Error('permanent failure'));

    await runHydrate();

    // At attempts=4, nextAttempts=5 >= MAX(5) → delete, not update
    expect(auditRetryDeleteSpy).toHaveBeenCalledWith('retry-max');
    expect(auditRetryUpdateSpy).not.toHaveBeenCalled();
  });

  it('max-attempts exhausted: emits system alert', async () => {
    const entry = { ...makeRetryEntry({ id: 'retry-exhausted', attempts: 4 }), updatedAt: 0 };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    permissionAuditInsertSpy.mockRejectedValue(new Error('permanent failure'));

    const mod = await import('./store');
    await runHydrate();

    const { systemAlerts } = mod.useAppStore.getState();
    const alert = systemAlerts.find((a) => a.kind === 'audit-retry-exhausted');
    expect(alert).toBeDefined();
    expect(alert?.kind).toBe('audit-retry-exhausted');
    expect(alert?.message).toContain('5 attempts');
  });

  it('drain skips rows with invalid JSON payload (deletes them)', async () => {
    const entry = {
      ...makeRetryEntry({ id: 'retry-bad-json', payloadJson: 'not-json' }),
      updatedAt: 0,
    };
    auditRetryDrainSpy.mockResolvedValue([entry]);

    await runHydrate();

    expect(auditRetryDeleteSpy).toHaveBeenCalledWith('retry-bad-json');
    expect(permissionAuditInsertSpy).not.toHaveBeenCalled();
  });

  it('corrupt payload: emits system alert', async () => {
    const entry = {
      ...makeRetryEntry({ id: 'retry-bad-json', payloadJson: 'not-json' }),
      updatedAt: 0,
    };
    auditRetryDrainSpy.mockResolvedValue([entry]);

    const mod = await import('./store');
    await runHydrate();

    const { systemAlerts } = mod.useAppStore.getState();
    const alert = systemAlerts.find((a) => a.kind === 'audit-retry-corrupt');
    expect(alert).toBeDefined();
    expect(alert?.kind).toBe('audit-retry-corrupt');
    expect(alert?.message).toContain('corrupt payload');
  });

  it('backoff: skips entry whose updatedAt is too recent for attempt count', async () => {
    // attempts=0 → backoff=1000ms. updatedAt is NOW (recent) → should skip.
    const entry = {
      ...makeRetryEntry({ id: 'retry-backoff', attempts: 0 }),
      updatedAt: Date.now(),
    };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    permissionAuditInsertSpy.mockResolvedValue({});

    await runHydrate();

    // Entry is within backoff window → should NOT have been processed
    expect(permissionAuditInsertSpy).not.toHaveBeenCalled();
    expect(auditRetryDeleteSpy).not.toHaveBeenCalled();
  });

  it('backoff: processes entry whose updatedAt is old enough', async () => {
    // attempts=0 → backoff=1000ms. updatedAt well in the past → should process.
    const entry = { ...makeRetryEntry({ id: 'retry-old', attempts: 0 }), updatedAt: 0 };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    permissionAuditInsertSpy.mockResolvedValue({});

    await runHydrate();

    expect(permissionAuditInsertSpy).toHaveBeenCalledTimes(1);
    expect(auditRetryDeleteSpy).toHaveBeenCalledWith('retry-old');
  });
});
