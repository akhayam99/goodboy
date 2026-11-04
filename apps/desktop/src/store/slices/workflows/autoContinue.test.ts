// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type SessionId,
  type WorkflowRunId,
} from '@goodboy/types';

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

type HarnessParams = { readonly autoRun: boolean; readonly runs?: ReadonlyArray<Agent> };

const buildHarness = ({ autoRun, runs = [] }: HarnessParams) => {
  const state = {
    sessions: [{ id: SESSION_ID, autoRun, workflowRuns: [{ id: RUN_ID, autoRun }] }],
    sessionPhaseRuns: { [SESSION_ID]: runs },
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
      hasStuckMarker: false,
    };

    await expect(continueOrPause({ ...params, unit: 'cluster' })).resolves.toBe('continued');
    await expect(continueOrPause({ ...params, unit: 'cluster' })).resolves.toBe('stuck');

    expect(restart).toHaveBeenCalledTimes(1);
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalled();
    expect(state.emitNotification).not.toHaveBeenCalled();
    expect(state.workflowContinueAttempts).toEqual({});
  });

  it('calls a hands-free step stuck at once when it says so, with no retry', async () => {
    const { set, get } = buildHarness({ autoRun: true });
    const restart = vi.fn();

    const outcome = await continueOrPause({
      set,
      get,
      sessionId: SESSION_ID,
      agent,
      workflowRunId: RUN_ID,
      unit: 'step',
      didAgentDie: false,
      hasStuckMarker: true,
      restart,
    });

    expect(outcome).toBe('stuck');
    expect(restart).not.toHaveBeenCalled();
  });

  it('blocks a stuck step when the one before it was stuck too', async () => {
    const { state, set, get } = buildHarness({
      autoRun: true,
      runs: [
        {
          ...agent,
          id: brandId<AgentId>({ value: 'earlier' }),
          ordinal: 0,
          status: 'skipped',
          outputSummary: 'a',
        },
        agent,
      ],
    });

    const outcome = await continueOrPause({
      set,
      get,
      sessionId: SESSION_ID,
      agent,
      workflowRunId: RUN_ID,
      unit: 'step',
      didAgentDie: false,
      hasStuckMarker: true,
      restart: vi.fn(),
    });

    expect(outcome).toBe('blocked');
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      'child-1',
      expect.objectContaining({ status: 'blocked' }),
    );
    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Run stopped on cluster 1' }),
    );
  });

  it('blocks a stuck step at once when the run asks every step', async () => {
    const { set, get } = buildHarness({ autoRun: false });

    const outcome = await continueOrPause({
      set,
      get,
      sessionId: SESSION_ID,
      agent,
      workflowRunId: RUN_ID,
      unit: 'step',
      didAgentDie: false,
      hasStuckMarker: true,
      restart: vi.fn(),
    });

    expect(outcome).toBe('blocked');
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
      hasStuckMarker: false,
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
      hasStuckMarker: false,
      restart,
    });

    expect(outcome).toBe('blocked');
    expect(restart).not.toHaveBeenCalled();
    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'warning',
        title: 'Step blocked on cluster 1',
        body: expect.stringContaining('is set to Every step'),
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
      hasStuckMarker: false,
      restart,
    };

    await continueOrPause(params);
    resetContinueAttempts({ set, get, agentId: agent.id });
    await continueOrPause(params);

    expect(restart).toHaveBeenCalledTimes(2);
  });
});
