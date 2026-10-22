// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { isAgentClosable, isAgentClosedByUser, isTurnStateLive } from './agent-lifecycle';

const DONE_AT = '2026-09-24T10:00:00.000Z' as IsoDateTime;

const buildAgent = (fields: Partial<Agent> = {}): Agent => ({
  id: 'agent-1' as AgentId,
  sessionId: 'session-1' as SessionId,
  ordinal: 0,
  name: 'agent',
  status: 'completed',
  ...fields,
});

describe('isAgentClosable', () => {
  it('offers close only to an agent outside a workflow that failed or asks', () => {
    expect(
      isAgentClosable({
        agent: buildAgent({ status: 'failed' }),
        hasOpenQuestion: false,
        isTurnLive: false,
      }),
    ).toBe(true);
    expect(isAgentClosable({ agent: buildAgent(), hasOpenQuestion: true, isTurnLive: false })).toBe(
      true,
    );
    expect(
      isAgentClosable({ agent: buildAgent(), hasOpenQuestion: false, isTurnLive: false }),
    ).toBe(false);
  });

  it('refuses a workflow step, an agent already closed and a live turn', () => {
    const failed = buildAgent({ status: 'failed' });
    expect(
      isAgentClosable({
        agent: { ...failed, workflowRunId: 'run-1' as WorkflowRunId },
        hasOpenQuestion: false,
        isTurnLive: false,
      }),
    ).toBe(false);
    expect(
      isAgentClosable({
        agent: { ...failed, doneAt: DONE_AT },
        hasOpenQuestion: false,
        isTurnLive: false,
      }),
    ).toBe(false);
    expect(isAgentClosable({ agent: failed, hasOpenQuestion: false, isTurnLive: true })).toBe(
      false,
    );
  });
});

describe('isAgentClosedByUser', () => {
  it('reads closed only when you closed work that did not finish', () => {
    expect(isAgentClosedByUser({ agent: buildAgent({ status: 'failed', doneAt: DONE_AT }) })).toBe(
      true,
    );
    expect(isAgentClosedByUser({ agent: buildAgent({ doneAt: DONE_AT }) })).toBe(false);
    expect(isAgentClosedByUser({ agent: buildAgent({ status: 'failed' }) })).toBe(false);
  });
});

describe('isTurnStateLive', () => {
  it('treats starting and running turns as live, and a turn waiting on approval as not', () => {
    const at = DONE_AT;
    const runId = 'run-1' as ProviderRunId;
    expect(isTurnStateLive({ turnState: { kind: 'starting', startedAt: at } })).toBe(true);
    expect(isTurnStateLive({ turnState: { kind: 'running', runId, startedAt: at } })).toBe(true);
    expect(isTurnStateLive({ turnState: { kind: 'blocked', runId, blockedAt: at } })).toBe(false);
    expect(isTurnStateLive({ turnState: { kind: 'idle', lastActivityAt: at } })).toBe(false);
    expect(isTurnStateLive({ turnState: null })).toBe(false);
  });

  it('counts a turn waiting on approval only when the caller asks for blocked work', () => {
    const at = DONE_AT;
    const runId = 'run-1' as ProviderRunId;
    const blocked = { kind: 'blocked', runId, blockedAt: at } as const;
    expect(isTurnStateLive({ turnState: blocked, includeBlocked: true })).toBe(true);
    expect(
      isTurnStateLive({ turnState: { kind: 'starting', startedAt: at }, includeBlocked: true }),
    ).toBe(true);
    expect(
      isTurnStateLive({ turnState: { kind: 'idle', lastActivityAt: at }, includeBlocked: true }),
    ).toBe(false);
  });
});
