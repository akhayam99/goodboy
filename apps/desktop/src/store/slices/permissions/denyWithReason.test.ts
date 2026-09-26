import { describe, expect, it, vi } from 'vitest';
import type { AgentId, ProviderRunId, SessionId, TurnState } from '@goodboy/types';
import { denyWithReason } from './denyWithReason';
import type { GetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;

type Harness = {
  readonly get: GetFn;
  readonly resolvePermissionRequest: ReturnType<typeof vi.fn>;
  readonly sendTurn: ReturnType<typeof vi.fn>;
  readonly agentTurnState: Record<AgentId, TurnState>;
};

const createHarness = (): Harness => {
  const resolvePermissionRequest = vi.fn(async () => undefined);
  const sendTurn = vi.fn(async () => undefined);
  const agentTurnState: Record<AgentId, TurnState> = {};
  const get = (() => ({
    resolvePermissionRequest,
    sendTurn,
    agentTurnState,
  })) as unknown as GetFn;
  return { get, resolvePermissionRequest, sendTurn, agentTurnState };
};

describe('denyWithReason', () => {
  it('denies the request and tells the agent why in the same session', async () => {
    const { get, resolvePermissionRequest, sendTurn } = createHarness();

    await denyWithReason(get)({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolUseId: 'tu-1',
      toolName: 'Bash',
      runId: RUN_ID,
      reason: 'this would touch production data',
    });

    expect(resolvePermissionRequest).toHaveBeenCalledWith(
      expect.objectContaining({ toolUseId: 'tu-1', scope: 'deny' }),
    );
    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        content: 'Denied Bash. this would touch production data',
      }),
    );
  });

  it('denies without sending a follow-up turn when no reason is given', async () => {
    const { get, resolvePermissionRequest, sendTurn } = createHarness();

    await denyWithReason(get)({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolUseId: 'tu-2',
      toolName: 'Bash',
      runId: RUN_ID,
      reason: '   ',
    });

    expect(resolvePermissionRequest).toHaveBeenCalled();
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('does not pile a second turn onto one already running', async () => {
    const { get, agentTurnState, sendTurn } = createHarness();
    agentTurnState[AGENT_ID] = { kind: 'running', runId: RUN_ID, startedAt: '' as never };

    await denyWithReason(get)({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolUseId: 'tu-3',
      toolName: 'Bash',
      runId: RUN_ID,
      reason: 'wait for the tests first',
    });

    expect(sendTurn).not.toHaveBeenCalled();
  });
});
