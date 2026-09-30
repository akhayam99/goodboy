// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  BudgetAlert,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  StepId,
  TelemetryRecord,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import {
  budgetBlockMessage,
  isBudgetBlocked,
  loadSpendLimitTelemetry,
  resolveSpendLimitStop,
  sessionBudgetBlockAfterLoad,
} from './budgetBlock';

const SESSION_ID = 'ses-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;

const agent = (): Agent => ({
  id: 'agent-1' as AgentId,
  sessionId: SESSION_ID,
  stepId: 'step-1' as StepId,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'Scout',
  status: 'completed',
  runId: 'pr-1' as ProviderRunId,
});

const run = (spendLimitUsd?: number, spendLimitMode?: 'notify' | 'pause'): WorkflowRun => ({
  id: RUN_ID,
  workflowId: 'wf-1' as WorkflowId,
  ordinal: 0,
  currentStep: 0,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  ...(spendLimitUsd != null && { spendLimitUsd }),
  ...(spendLimitMode != null && { spendLimitMode }),
});

type State = Record<string, unknown>;

const stateWith = (spentUsd: number) => {
  const state: State = {
    sessionTelemetry: {
      [SESSION_ID]: [
        { runId: 'pr-1', kind: 'turn', estimatedCostUsd: spentUsd } as unknown as TelemetryRecord,
      ],
    },
    sessionPhaseRuns: { [SESSION_ID]: [agent()] },
    agentRunHistory: {},
    loadSessionTelemetry: vi.fn(async () => undefined),
  };
  return { state, get: (() => state) as never };
};

const budgetAlert = (overrides: Partial<BudgetAlert>): BudgetAlert => ({
  id: 'alert-1',
  kind: 'session-exceeded',
  currentUsd: 10,
  capUsd: 5,
  createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
  ...overrides,
});

describe('isBudgetBlocked', () => {
  it('stops the session when its own cap is exceeded', () => {
    expect(
      isBudgetBlocked({
        alerts: [budgetAlert({ sessionId: SESSION_ID })],
        budgets: {},
        sessionId: SESSION_ID,
      }),
    ).toBe(true);
  });

  it('leaves the session running when one provider is over its own cap', () => {
    expect(
      isBudgetBlocked({
        alerts: [budgetAlert({ kind: 'provider-exceeded', provider: 'openai' })],
        budgets: {},
        sessionId: SESSION_ID,
      }),
    ).toBe(false);
  });

  it('keeps the session running when its limit only warns', () => {
    expect(
      isBudgetBlocked({
        alerts: [budgetAlert({ sessionId: SESSION_ID })],
        budgets: { [SESSION_ID]: { sessionId: SESSION_ID, softCapUsd: 5, onExceed: 'warn' } },
        sessionId: SESSION_ID,
      }),
    ).toBe(false);
  });

  it('says the limit that paused the session', () => {
    expect(budgetBlockMessage({ limitUsd: 10 })).toBe(
      'Paused at the $10.00 spend limit for this session.',
    );
  });

  it('reads the limit mode before it decides, when it was never loaded', async () => {
    const state: Record<string, unknown> = {
      budgetAlerts: [budgetAlert({ sessionId: SESSION_ID })],
      sessionBudgets: {},
    };
    state['loadSessionBudget'] = vi.fn(async () => {
      state['sessionBudgets'] = {
        [SESSION_ID]: { sessionId: SESSION_ID, softCapUsd: 5, onExceed: 'warn' },
      };
    });

    const block = await sessionBudgetBlockAfterLoad({
      get: (() => state) as never,
      sessionId: SESSION_ID,
    });

    expect(block).toBeNull();
    expect(state['loadSessionBudget']).toHaveBeenCalledWith(SESSION_ID);
  });

  it('ignores another session exceeded cap', () => {
    expect(
      isBudgetBlocked({
        alerts: [budgetAlert({ sessionId: 'ses-2' as SessionId })],
        budgets: {},
        sessionId: SESSION_ID,
      }),
    ).toBe(false);
  });
});

describe('resolveSpendLimitStop', () => {
  it('pauses a run that spent past its limit', () => {
    const { get } = stateWith(7);

    const stop = resolveSpendLimitStop({ get, sessionId: SESSION_ID, run: run(5, 'pause') });

    expect(stop).toEqual({ kind: 'pause', limitUsd: 5, message: expect.any(String) });
  });

  it('reports a notify stop instead of swallowing it', () => {
    const { get } = stateWith(7);

    const stop = resolveSpendLimitStop({ get, sessionId: SESSION_ID, run: run(5, 'notify') });

    expect(stop?.kind).toBe('notify');
  });

  it('stays silent while the run is under its limit', () => {
    const { get } = stateWith(2);

    expect(resolveSpendLimitStop({ get, sessionId: SESSION_ID, run: run(5, 'pause') })).toBe(null);
  });

  it('stays silent for a run without a limit', () => {
    const { get } = stateWith(99);

    expect(resolveSpendLimitStop({ get, sessionId: SESSION_ID, run: run() })).toBe(null);
  });
});

describe('loadSpendLimitTelemetry', () => {
  it('reads telemetry once for a batch instead of once per run', async () => {
    const { state, get } = stateWith(7);

    await loadSpendLimitTelemetry({
      get,
      sessionId: SESSION_ID,
      runs: [run(5, 'pause'), run(9, 'notify'), run()],
    });

    expect(state['loadSessionTelemetry']).toHaveBeenCalledTimes(1);
    expect(state['loadSessionTelemetry']).toHaveBeenCalledWith(SESSION_ID);
  });

  it('never reads telemetry when no run in the batch has a limit', async () => {
    const { state, get } = stateWith(99);

    await loadSpendLimitTelemetry({ get, sessionId: SESSION_ID, runs: [run(), run()] });

    expect(state['loadSessionTelemetry']).not.toHaveBeenCalled();
  });
});
