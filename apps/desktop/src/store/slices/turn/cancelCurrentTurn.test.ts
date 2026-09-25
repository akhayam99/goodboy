import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';

const { cancelTurn, invokeAgentUpdateStatus, applyAgentTurnState, updateSessionState } = vi.hoisted(
  () => ({
    cancelTurn: vi.fn(async () => undefined),
    invokeAgentUpdateStatus: vi.fn(),
    applyAgentTurnState: vi.fn(() => 'idle'),
    updateSessionState: vi.fn(async () => undefined),
  }),
);

vi.mock('@goodboy/db', () => ({ updateSessionState }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/chat/turn', () => ({ cancelTurn }));
vi.mock('../../../features/workflows/workflows', () => ({ invokeAgentUpdateStatus }));
vi.mock('../../session-mutators', () => ({
  applyAgentTurnState,
  cancelledRunIds: new Set<string>(),
}));

import { cancelCurrentTurn, type CancelTurnReason } from './cancelCurrentTurn';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

type Harness = {
  readonly state: Record<string, unknown>;
  readonly cancel: ReturnType<typeof cancelCurrentTurn>;
};

const harness = (): Harness => {
  const state: Record<string, unknown> = {
    selectedAgentId: {},
    agentTurnState: { [AGENT_ID]: { kind: 'running', runId: 'run-1' } },
    sessionPhaseRuns: { [SESSION_ID]: [{ id: AGENT_ID, status: 'running' }] },
  };
  const set = ((update: (current: typeof state) => Partial<typeof state>) => {
    Object.assign(state, update(state));
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, cancel: cancelCurrentTurn(set, get) };
};

describe('cancelCurrentTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeAgentUpdateStatus.mockImplementation(async (id: AgentId, fields: Partial<Agent>) => ({
      id,
      ...fields,
    }));
  });

  it('marks the agent stopped by you before the process dies when you stop it', async () => {
    const { state, cancel } = harness();

    await cancel(SESSION_ID, AGENT_ID, 'user');

    expect(invokeAgentUpdateStatus).toHaveBeenCalledWith(AGENT_ID, {
      status: 'stopped',
      stoppedAt: expect.any(String),
      stoppedBy: 'you',
    });
    expect(invokeAgentUpdateStatus.mock.invocationCallOrder[0]).toBeLessThan(
      cancelTurn.mock.invocationCallOrder[0] ?? 0,
    );
    const runs = (state.sessionPhaseRuns as Record<string, ReadonlyArray<Agent>>)[SESSION_ID];
    expect(runs?.[0]?.status).toBe('stopped');
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
