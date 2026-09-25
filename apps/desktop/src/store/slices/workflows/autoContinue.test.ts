import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, SessionId, WorkflowRunId } from '@goodboy/types';

const hoisted = vi.hoisted(() => ({
  invokeAgentList: vi.fn(async () => []),
  invokeAgentUpdateStatus: vi.fn(async () => undefined),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: hoisted.invokeAgentList,
  invokeAgentUpdateStatus: hoisted.invokeAgentUpdateStatus,
}));

const { continueOrPause, resetContinueAttempts } = await import('./autoContinue');

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const agent: Agent = {
  id: 'child-1' as AgentId,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  ordinal: 1,
  name: 'cluster 1',
  status: 'running',
};

type HarnessParams = { readonly autoRun: boolean };

const buildHarness = ({ autoRun }: HarnessParams) => {
  const state = {
    sessions: [{ id: SESSION_ID, autoRun, workflowRuns: [{ id: RUN_ID, autoRun }] }],
    sessionPhaseRuns: {},
    workflowContinueAttempts: {},
    refreshUnreadWorkspaces: vi.fn(),
    emitNotification: vi.fn(),
  };
  const set = vi.fn((update: unknown) => {
    const patch = typeof update === 'function' ? update(state) : update;
    Object.assign(state, patch);
  });
  const get = () => state;
  return { state, set: set as never, get: get as never };
};

describe('continueOrPause', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('continues a live hands-free cluster once, then blocks it instead of failing it', async () => {
    const { state, set, get } = buildHarness({ autoRun: true });
    const restart = vi.fn();
    const params = {
      set,
      get,
      sessionId: SESSION_ID,
      agent,
      workflowRunId: RUN_ID,
      restart,
      didAgentDie: false,
    };

    await expect(continueOrPause({ ...params, unit: 'cluster' })).resolves.toBe('continued');
    await expect(continueOrPause({ ...params, unit: 'cluster' })).resolves.toBe('blocked');

    expect(restart).toHaveBeenCalledTimes(1);
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      'child-1',
      expect.objectContaining({ status: 'blocked' }),
    );
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalledWith(
      'child-1',
      expect.objectContaining({ status: 'failed' }),
    );
    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'warning',
        title: 'Subagent blocked on cluster 1',
        body: expect.stringContaining('without asking you anything'),
        sessionId: SESSION_ID,
      }),
    );
    expect(state.workflowContinueAttempts).toEqual({});
  });

  it('marks the agent failed only when its last turn died', async () => {
    const { state, set, get } = buildHarness({ autoRun: true });
    const restart = vi.fn();
    const params = {
      set,
      get,
      sessionId: SESSION_ID,
      agent,
      workflowRunId: RUN_ID,
      unit: 'step' as const,
      restart,
      didAgentDie: true,
    };

    await expect(continueOrPause(params)).resolves.toBe('continued');
    await expect(continueOrPause(params)).resolves.toBe('failed');

    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      'child-1',
      expect.objectContaining({ status: 'failed' }),
    );
    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Step failed on cluster 1',
        body: expect.stringContaining('stopped responding'),
      }),
    );
  });

  it('blocks at once when autorun is off', async () => {
    const { state, set, get } = buildHarness({ autoRun: false });
    const restart = vi.fn();

    const outcome = await continueOrPause({
      set,
      get,
      sessionId: SESSION_ID,
      agent,
      workflowRunId: RUN_ID,
      unit: 'step',
      didAgentDie: false,
      restart,
    });

    expect(outcome).toBe('blocked');
    expect(restart).not.toHaveBeenCalled();
    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'warning',
        title: 'Step blocked on cluster 1',
        body: expect.stringContaining('Autorun is off'),
        sessionId: SESSION_ID,
      }),
    );
  });

  it('gives the continue back after a reset', async () => {
    const { set, get } = buildHarness({ autoRun: true });
    const restart = vi.fn();
    const params = {
      set,
      get,
      sessionId: SESSION_ID,
      agent,
      workflowRunId: RUN_ID,
      unit: 'step' as const,
      didAgentDie: false,
      restart,
    };

    await continueOrPause(params);
    resetContinueAttempts({ set, get, agentId: agent.id });
    await continueOrPause(params);

    expect(restart).toHaveBeenCalledTimes(2);
  });
});
