import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId, TaskId } from '@kay-am/types';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before store import
// ---------------------------------------------------------------------------

vi.mock('../../turn', () => ({
  runTurn: vi.fn(),
  cancelTurn: vi.fn(),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

vi.mock('../../permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionAuditInsert: vi.fn(async () => undefined),
  invokeAuditRetryEnqueue: vi.fn(async () => undefined),
  invokeAuditRetryDrain: vi.fn(async () => []),
  invokeAuditRetryUpdate: vi.fn(async () => undefined),
  invokeAuditRetryDelete: vi.fn(async () => undefined),
  useEffectivePermissionRules: () => [],
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

vi.mock('../../db', () => ({
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

vi.mock('../../budget', () => ({
  invokeBudgetRuleList: vi.fn(async () => []),
  invokeBudgetRuleUpsert: vi.fn(),
  invokeBudgetRuleDelete: vi.fn(),
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetAlertDismiss: vi.fn(),
  invokeSessionBudgetGet: vi.fn(),
  invokeSessionBudgetSet: vi.fn(),
  invokeCheckProviderBudget: vi.fn(),
}));

vi.mock('../../skills', () => ({
  invokeSkillList: vi.fn(async () => []),
  invokeSkillUpsert: vi.fn(),
  invokeSkillDelete: vi.fn(),
  invokeSkillRescan: vi.fn(),
  resolveSkillInvocation: vi.fn(),
}));

vi.mock('../../phases', () => ({
  invokePhaseTemplateList: vi.fn(async () => []),
  invokePhaseTemplateUpsert: vi.fn(),
  invokePhaseTemplateDelete: vi.fn(),
  invokePhaseRunList: vi.fn(async () => []),
  invokePhaseRunInsert: vi.fn(),
  invokePhaseRunUpdateStatus: vi.fn(),
}));

vi.mock('../../worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
}));

vi.mock('../../repo', () => ({ validateGitRepo: vi.fn() }));

vi.mock('../../providerPricing', () => ({
  parseProviderPricingConfig: vi.fn(() => null),
  getCodexPriceOverride: vi.fn(() => null),
  refreshPricingTable: vi.fn(() => Promise.resolve()),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SESSION_ID = 'sess-1' as TaskId;
const RUN_ID = 'run-1' as ProviderRunId;
const AT: IsoDateTime = '2026-05-07T00:00:00.000Z' as IsoDateTime;

describe('store unknownPayloadCounts', () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  let useAppStore: (typeof import('../../store/store'))['useAppStore'];

  beforeEach(async () => {
    vi.resetModules();
    ({ useAppStore } = await import('../../store/store'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts at empty object', () => {
    const counts = useAppStore.getState().unknownPayloadCounts;
    expect(counts).toEqual({});
  });

  it('increments counter keyed by adapter:payloadType on first unknown_payload', () => {
    const { appendTurnEvent } = useAppStore.getState();
    appendTurnEvent(SESSION_ID, {
      kind: 'unknown_payload',
      runId: RUN_ID,
      adapter: 'anthropic',
      payloadType: 'ping',
      raw: { type: 'ping' },
      at: AT,
    });
    expect(useAppStore.getState().unknownPayloadCounts['anthropic:ping']).toBe(1);
  });

  it('accumulates multiple events of the same key', () => {
    const { appendTurnEvent } = useAppStore.getState();
    for (let i = 0; i < 3; i++) {
      appendTurnEvent(SESSION_ID, {
        kind: 'unknown_payload',
        runId: RUN_ID,
        adapter: 'cursor',
        payloadType: 'debug_trace',
        raw: {},
        at: AT,
      });
    }
    expect(useAppStore.getState().unknownPayloadCounts['cursor:debug_trace']).toBe(3);
  });

  it('tracks different adapter/payloadType keys independently', () => {
    const { appendTurnEvent } = useAppStore.getState();
    appendTurnEvent(SESSION_ID, {
      kind: 'unknown_payload',
      runId: RUN_ID,
      adapter: 'anthropic',
      payloadType: 'ping',
      raw: {},
      at: AT,
    });
    appendTurnEvent(SESSION_ID, {
      kind: 'unknown_payload',
      runId: RUN_ID,
      adapter: 'codex',
      payloadType: 'ping',
      raw: {},
      at: AT,
    });
    const counts = useAppStore.getState().unknownPayloadCounts;
    expect(counts['anthropic:ping']).toBe(1);
    expect(counts['codex:ping']).toBe(1);
  });

  it('does not increment counter for non-unknown_payload events', () => {
    const { appendTurnEvent } = useAppStore.getState();
    appendTurnEvent(SESSION_ID, {
      kind: 'assistant_text',
      runId: RUN_ID,
      delta: 'hello',
      at: AT,
    });
    expect(useAppStore.getState().unknownPayloadCounts).toEqual({});
  });
});
