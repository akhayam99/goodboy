import { describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  ProviderRunId,
  SessionId,
  StepId,
  TelemetryRecord,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { resolveSpendLimitStop } from './budgetBlock';

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

describe('resolveSpendLimitStop', () => {
  it('pauses a run that spent past its limit', async () => {
    const { state, get } = stateWith(7);

    const stop = await resolveSpendLimitStop({ get, sessionId: SESSION_ID, run: run(5, 'pause') });

    expect(stop).toEqual({ kind: 'pause', limitUsd: 5, message: expect.any(String) });
    expect(state['loadSessionTelemetry']).toHaveBeenCalledWith(SESSION_ID);
  });

  it('reports a notify stop instead of swallowing it', async () => {
    const { get } = stateWith(7);

    const stop = await resolveSpendLimitStop({ get, sessionId: SESSION_ID, run: run(5, 'notify') });

    expect(stop?.kind).toBe('notify');
  });

  it('stays silent while the run is under its limit', async () => {
    const { get } = stateWith(2);

    expect(await resolveSpendLimitStop({ get, sessionId: SESSION_ID, run: run(5, 'pause') })).toBe(
      null,
    );
  });

  it('never loads telemetry for a run without a limit', async () => {
    const { state, get } = stateWith(99);

    expect(await resolveSpendLimitStop({ get, sessionId: SESSION_ID, run: run() })).toBe(null);
    expect(state['loadSessionTelemetry']).not.toHaveBeenCalled();
  });
});
