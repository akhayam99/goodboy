import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand';
import type {
  BudgetAlert,
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecord,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';

const {
  insertTelemetry,
  invokeBudgetAlertsList,
  invokeBudgetEmitAlerts,
  invokeBudgetRuleList,
  summarizeSessionTelemetry,
  summarizeWorkspaceProviderTelemetry,
  summarizeWorkspaceTelemetry,
} = vi.hoisted(() => ({
  insertTelemetry: vi.fn(async () => undefined),
  invokeBudgetAlertsList: vi.fn(async () => [] as ReadonlyArray<BudgetAlert>),
  invokeBudgetEmitAlerts: vi.fn(async () => [] as ReadonlyArray<BudgetAlert>),
  invokeBudgetRuleList: vi.fn(async () => []),
  summarizeSessionTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
}));

vi.mock('@goodboy/core', () => ({
  computeProviderCostUsd: vi.fn(() => 2.5),
}));

vi.mock('@goodboy/db', () => ({
  insertTelemetry,
  summarizeSessionTelemetry,
  summarizeWorkspaceProviderTelemetry,
  summarizeWorkspaceTelemetry,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/budget/budget', () => ({
  invokeBudgetAlertsList,
  invokeBudgetEmitAlerts,
  invokeBudgetRuleList,
}));

import { recordUsageTelemetry } from './recordUsageTelemetry';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const FIRST_RUN_ID = 'run-1' as ProviderRunId;
const SECOND_RUN_ID = 'run-2' as ProviderRunId;
const NOW = '2026-08-02T12:00:00.000Z' as IsoDateTime;

const session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Finish the budget path',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  autoRun: false,
  titleUserEdited: false,
  workflowRuns: [],
  createdAt: NOW,
  updatedAt: NOW,
} satisfies Session;

const alert = {
  id: 'alert-1',
  kind: 'session-exceeded',
  sessionId: SESSION_ID,
  currentUsd: 12.3,
  capUsd: 10,
  createdAt: NOW,
} satisfies BudgetAlert;

type TestState = {
  sessions: ReadonlyArray<Session>;
  sessionTelemetry: Record<string, ReadonlyArray<TelemetryRecord>>;
  sessionSummary: unknown;
  workspaceSummary: unknown;
  providerSpendBreakdown: ReadonlyArray<unknown>;
  budgetAlerts: ReadonlyArray<BudgetAlert>;
  emitNotification: ReturnType<typeof vi.fn>;
};

describe('recordUsageTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeBudgetAlertsList.mockResolvedValue([alert]);
    invokeBudgetEmitAlerts.mockResolvedValueOnce([alert]).mockResolvedValueOnce([]);
  });

  it('emits one notification for the first session cap breach and none for the next turn', async () => {
    const emitNotification = vi.fn(async () => undefined);
    const store = createStore<TestState>(() => ({
      sessions: [session],
      sessionTelemetry: {},
      sessionSummary: null,
      workspaceSummary: null,
      providerSpendBreakdown: [],
      budgetAlerts: [],
      emitNotification,
    }));
    const usage = {
      inputTokens: 1_000,
      outputTokens: 500,
      cachedInputTokens: 0,
      estimatedCostUsd: 2.5,
    };

    await recordUsageTelemetry(store.setState as never, store.getState as never, {
      event: { kind: 'usage', runId: FIRST_RUN_ID, usage, at: NOW } satisfies Extract<
        TurnEvent,
        { kind: 'usage' }
      >,
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      runId: FIRST_RUN_ID,
      sessionId: SESSION_ID,
      now: () => NOW,
    });

    expect(emitNotification).toHaveBeenCalledOnce();
    expect(emitNotification).toHaveBeenCalledWith(
      'budget-cap',
      'error',
      'Session budget cap reached',
      '$12.30 spent against a $10.00 cap.',
      {
        sessionId: SESSION_ID,
        action: { kind: 'open-budget', sessionId: SESSION_ID },
      },
    );

    await recordUsageTelemetry(store.setState as never, store.getState as never, {
      event: { kind: 'usage', runId: SECOND_RUN_ID, usage, at: NOW } satisfies Extract<
        TurnEvent,
        { kind: 'usage' }
      >,
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      runId: SECOND_RUN_ID,
      sessionId: SESSION_ID,
      now: () => NOW,
    });

    expect(emitNotification).toHaveBeenCalledOnce();
  });
});
