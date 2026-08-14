import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  ProviderRunId,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';

vi.mock('@goodboy/db', () => ({
  insertProviderRun: vi.fn(async () => undefined),
  insertTelemetry: vi.fn(async () => undefined),
  summarizeSessionTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  updateProviderRunStatus: vi.fn(async () => undefined),
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { recordOrchestratorUsage } from './recordOrchestratorUsage';

const SESSION_ID = 'ses-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const OTHER_RUN_ID = 'run-2' as WorkflowRunId;

const agent = (ordinal: number, workflowRunId: WorkflowRunId): Agent => ({
  id: `agent-${ordinal}` as AgentId,
  sessionId: SESSION_ID,
  stepId: `step-${ordinal}` as StepId,
  workflowRunId,
  ordinal,
  name: `step ${ordinal}`,
  status: 'completed',
  runId: `pr-${ordinal}` as ProviderRunId,
});

const usage = {
  inputTokens: 10,
  outputTokens: 5,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  estimatedCostUsd: 0.4,
};

type State = Record<string, unknown>;

const harness = (agents: ReadonlyArray<Agent>) => {
  const state: State = {
    sessionTelemetry: {},
    sessionPhaseRuns: { [SESSION_ID]: agents },
    agentRunHistory: {},
    sessions: [{ id: SESSION_ID, workspaceId: 'ws-1' as WorkflowId }],
  };
  const set = vi.fn((updater: (current: State) => State) => {
    Object.assign(state, typeof updater === 'function' ? updater(state) : updater);
  });
  return { state, set: set as never, get: (() => state) as never };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recordOrchestratorUsage', () => {
  it('charges a decision with no agent of its own to the run it decided for', async () => {
    const { state, set, get } = harness([agent(0, RUN_ID), agent(1, RUN_ID)]);

    await recordOrchestratorUsage({
      set,
      get,
      sessionId: SESSION_ID,
      agentId: null,
      workflowRunId: RUN_ID,
      provider: 'anthropic',
      model: 'opus',
      usage,
    });

    const history = state['agentRunHistory'] as Record<string, ReadonlyArray<string>>;
    expect(history['agent-1']).toHaveLength(2);
  });

  it('never charges a decision to a run that did not make it', async () => {
    const { state, set, get } = harness([agent(0, OTHER_RUN_ID)]);

    await recordOrchestratorUsage({
      set,
      get,
      sessionId: SESSION_ID,
      agentId: null,
      workflowRunId: RUN_ID,
      provider: 'anthropic',
      model: 'opus',
      usage,
    });

    expect(state['agentRunHistory']).toEqual({});
  });
});
