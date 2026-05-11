import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskId } from '@kay-am/types';
import type { NextAction } from '@kay-am/core';

vi.mock('../turn', () => ({
  runTurn: vi.fn(),
  cancelTurn: vi.fn(),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

vi.mock('../permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionAuditInsert: vi.fn(async () => ({})),
  invokeAuditRetryEnqueue: vi.fn(),
  invokeAuditRetryDrain: vi.fn(async () => []),
  invokeAuditRetryUpdate: vi.fn(),
  invokeAuditRetryDelete: vi.fn(),
  useEffectivePermissionRules: () => [],
}));

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

vi.mock('../db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
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

vi.mock('../worktree', () => ({ createWorktree: vi.fn(), removeWorktree: vi.fn() }));
vi.mock('../repo', () => ({ validateGitRepo: vi.fn() }));
vi.mock('../providerPricing', () => ({
  parseProviderPricingConfig: vi.fn(() => null),
  getCodexPriceOverride: vi.fn(() => null),
  refreshPricingTable: vi.fn(() => Promise.resolve()),
}));

vi.mock('@kay-am/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@kay-am/core')>();
  return { ...original };
});

vi.mock('@kay-am/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(),
  insertTask: vi.fn(),
  insertTaskWorktree: vi.fn(),
  insertTelemetry: vi.fn(),
  insertWorkspace: vi.fn(),
  insertContextSlotHistory: vi.fn(async () => undefined),
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

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => ({
    stdout: JSON.stringify({ result: '{"upserts":[]}', usage: {} }),
    stderr: '',
    exitCode: 0,
  })),
}));

const TASK_ID = 'task-next-actions' as TaskId;

const ACTIONS_PLAN: ReadonlyArray<NextAction> = [
  { id: 'spawn_planner', label: 'start plan', kind: 'planner' },
];
const ACTIONS_PR: ReadonlyArray<NextAction> = [{ id: 'open_pr', label: 'open pr' }];

describe('sessionNextActions store slice', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initial state has empty sessionNextActions', async () => {
    const { useAppStore } = await import('./store');
    expect(useAppStore.getState().sessionNextActions).toEqual({});
  });

  it('latest summarize result overwrites previous nextActions for the same task', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({ sessionNextActions: { [TASK_ID]: ACTIONS_PLAN } });
    expect(useAppStore.getState().sessionNextActions[TASK_ID]).toEqual(ACTIONS_PLAN);

    // Simulate runSummarizer success branch overwriting.
    useAppStore.setState((state) => ({
      sessionNextActions: { ...state.sessionNextActions, [TASK_ID]: ACTIONS_PR },
    }));
    expect(useAppStore.getState().sessionNextActions[TASK_ID]).toEqual(ACTIONS_PR);
  });

  it('clearSessionNextActions removes the entry', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({ sessionNextActions: { [TASK_ID]: ACTIONS_PLAN } });
    useAppStore.getState().clearSessionNextActions(TASK_ID);
    expect(useAppStore.getState().sessionNextActions[TASK_ID]).toBeUndefined();
  });

  it('clearSessionNextActions is a no-op when entry is absent', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({ sessionNextActions: {} });
    expect(() => useAppStore.getState().clearSessionNextActions(TASK_ID)).not.toThrow();
    expect(useAppStore.getState().sessionNextActions).toEqual({});
  });
});
