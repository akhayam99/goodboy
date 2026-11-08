// @vitest-environment node
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';

const {
  cancelTurn,
  listLiveRunIds,
  invokeAgentUpdateStatus,
  applyAgentTurnState,
  updateSessionState,
  replaceAgentQueuedMessages,
} = vi.hoisted(() => ({
  cancelTurn: vi.fn(async (_runId: string): Promise<void> => undefined),
  listLiveRunIds: vi.fn(async (): Promise<ReadonlySet<string>> => new Set<string>()),
  invokeAgentUpdateStatus: vi.fn(),
  applyAgentTurnState: vi.fn(() => 'idle'),
  updateSessionState: vi.fn(async () => undefined),
  replaceAgentQueuedMessages: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    updateSessionState,
    replaceAgentQueuedMessages,
  }),
);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/chat/turn', () => ({ cancelTurn, listLiveRunIds }));
vi.mock('../../../features/workflows/workflows', () => ({ invokeAgentUpdateStatus }));
vi.mock('../sessions/sessionMutators', () => ({
  applyAgentTurnState,
  cancelledRunIds: new Set<string>(),
}));

import { cancelCurrentTurn, type CancelTurnReason } from './cancelCurrentTurn';
import { cancelTurnConfirmed } from './cancelTurnConfirmed';
import { stopRequests } from './stopRequests';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

type Harness = {
  readonly state: Record<string, unknown>;
  readonly drainAgentQueue: Mock<(params: unknown) => Promise<undefined>>;
  readonly cancel: ReturnType<typeof cancelCurrentTurn>;
  readonly confirmed: ReturnType<typeof cancelTurnConfirmed>;
};

const reportError = vi.fn(async (_params: unknown) => undefined);

const harness = (): Harness => {
  const drainAgentQueue = vi.fn(async (_params: unknown) => undefined);
  const state: Record<string, unknown> = {
    reportError,
    joinFanOutParent: vi.fn(async () => undefined),
    drainAgentQueue,
    agentQueue: {
      [AGENT_ID]: [
        { id: 'auto-message:delegation-scout:id-1', agentId: AGENT_ID, status: 'queued' },
        { id: 'queued-by-you', agentId: AGENT_ID, status: 'queued' },
      ],
    },
    selectedAgentId: {},
    agentTurnState: { [AGENT_ID]: { kind: 'running', runId: 'run-1' } },
    sessionPhaseRuns: { [SESSION_ID]: [{ id: AGENT_ID, status: 'running' }] },
  };
  const set = ((update: (current: typeof state) => Partial<typeof state>) => {
    Object.assign(state, update(state));
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  return {
    state,
    drainAgentQueue,
    cancel: cancelCurrentTurn(set, get),
    confirmed: cancelTurnConfirmed(set, get),
  };
};

describe('cancelCurrentTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listLiveRunIds.mockResolvedValue(new Set<string>());
    invokeAgentUpdateStatus.mockImplementation(async (id: AgentId, fields: Partial<Agent>) => ({
      id,
      ...fields,
    }));
  });

  it('marks the agent stopped by you only after the process is gone when you stop it', async () => {
    const { state, cancel } = harness();

    await cancel(SESSION_ID, AGENT_ID, 'user');

    expect(invokeAgentUpdateStatus).toHaveBeenCalledWith(AGENT_ID, {
      status: 'stopped',
      stoppedAt: expect.any(String),
      stoppedBy: 'you',
    });
    expect(cancelTurn.mock.invocationCallOrder[0]).toBeLessThan(
      invokeAgentUpdateStatus.mock.invocationCallOrder[0] ?? 0,
    );
    const runs = (state.sessionPhaseRuns as Record<string, ReadonlyArray<Agent>>)[SESSION_ID];
    expect(runs?.[0]?.status).toBe('stopped');
  });

  it('marks the agent stopped by Auto when Auto stops it, and leaves the toast to Auto', async () => {
    const { state, confirmed } = harness();

    await confirmed({ sessionId: SESSION_ID, agentId: AGENT_ID, reason: 'auto' });

    expect(invokeAgentUpdateStatus).toHaveBeenCalledWith(AGENT_ID, {
      status: 'stopped',
      stoppedAt: expect.any(String),
      stoppedBy: 'auto',
    });
    expect(state.sessionPhaseRuns).toEqual({
      [SESSION_ID]: [expect.objectContaining({ stoppedBy: 'auto' })],
    });
    expect(state.joinFanOutParent).not.toHaveBeenCalled();
  });

  it('marks the agent stopped by Auto at once when the process exits late, before the queue drains', async () => {
    listLiveRunIds.mockResolvedValue(new Set(['run-1']));
    vi.useFakeTimers();
    const { state, confirmed, drainAgentQueue } = harness();

    const pending = confirmed({ sessionId: SESSION_ID, agentId: AGENT_ID, reason: 'auto' });
    await vi.runAllTimersAsync();
    const outcome = await pending;
    vi.useRealTimers();

    expect(outcome.outcome).toBe('still_running');
    expect(state.sessionPhaseRuns).toEqual({
      [SESSION_ID]: [expect.objectContaining({ status: 'stopped', stoppedBy: 'auto' })],
    });
    expect(invokeAgentUpdateStatus.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      drainAgentQueue.mock.invocationCallOrder[0] ?? 0,
    );
    expect(reportError).not.toHaveBeenCalled();
    stopRequests.settle({ agentId: AGENT_ID });
  });

  it.each<CancelTurnReason>(['auto', 'user'])(
    'drops the queued Auto messages on a stop by %s and keeps the rest',
    async (reason) => {
      const { state, confirmed } = harness();

      await confirmed({ sessionId: SESSION_ID, agentId: AGENT_ID, reason });

      expect(state.agentQueue).toEqual({
        [AGENT_ID]: [expect.objectContaining({ id: 'queued-by-you' })],
      });
      expect(replaceAgentQueuedMessages).toHaveBeenCalledOnce();
    },
  );

  it('keeps the queued Auto messages through a handoff', async () => {
    const { state, confirmed } = harness();

    await confirmed({ sessionId: SESSION_ID, agentId: AGENT_ID, reason: 'handoff' });

    expect(state.agentQueue).toEqual({
      [AGENT_ID]: [
        expect.objectContaining({ id: 'auto-message:delegation-scout:id-1' }),
        expect.objectContaining({ id: 'queued-by-you' }),
      ],
    });
    expect(replaceAgentQueuedMessages).not.toHaveBeenCalled();
  });

  it('logs a stop the process refused', async () => {
    cancelTurn.mockRejectedValueOnce(new Error('the process did not exit'));
    listLiveRunIds.mockResolvedValue(new Set(['run-1']));
    const { cancel } = harness();

    await cancel(SESSION_ID, AGENT_ID, 'user');

    expect(reportError).toHaveBeenCalledWith({
      recovery: { clause: 'check-state' },
      title: "Couldn't stop the agent",
      error: new Error('the process did not exit'),
      sessionId: SESSION_ID,
    });
  });

  it('keeps the stop on record while the process refuses to exit, so the tail can say Still stopping', async () => {
    cancelTurn.mockRejectedValueOnce(new Error('the process did not exit'));
    listLiveRunIds.mockResolvedValue(new Set(['run-1']));
    const { cancel } = harness();

    await cancel(SESSION_ID, AGENT_ID, 'user');

    expect(stopRequests.of({ agentId: AGENT_ID })).toMatchObject({ runId: 'run-1' });
    stopRequests.settle({ agentId: AGENT_ID });
  });

  it('clears the stop on record once the process is gone', async () => {
    listLiveRunIds.mockResolvedValue(new Set<string>());
    const { cancel } = harness();

    await cancel(SESSION_ID, AGENT_ID, 'user');

    expect(stopRequests.of({ agentId: AGENT_ID })).toBeNull();
  });

  it('stays quiet when a teardown cancel fails', async () => {
    cancelTurn.mockRejectedValueOnce(new Error('the process did not exit'));
    const { cancel } = harness();

    await cancel(SESSION_ID, AGENT_ID, 'teardown');

    expect(reportError).not.toHaveBeenCalled();
  });

  it.each<CancelTurnReason>(['handoff', 'teardown'])(
    'leaves the agent status alone on %s',
    async (reason) => {
      const { cancel } = harness();

      await cancel(SESSION_ID, AGENT_ID, reason);

      expect(invokeAgentUpdateStatus).not.toHaveBeenCalled();
      expect(cancelTurn).toHaveBeenCalledWith('run-1');
    },
  );

  it('defaults to teardown for system callers', async () => {
    const { cancel } = harness();

    await cancel(SESSION_ID, AGENT_ID);

    expect(invokeAgentUpdateStatus).not.toHaveBeenCalled();
  });
});
