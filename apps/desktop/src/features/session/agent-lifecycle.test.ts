import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import {
  isAgentClosable,
  isAgentClosedByUser,
  isAgentFinished,
  isTurnStateLive,
} from './agent-lifecycle';

const DONE_AT = '2026-09-24T10:00:00.000Z' as IsoDateTime;

const buildAgent = (fields: Partial<Agent> = {}): Agent => ({
  id: 'agent-1' as AgentId,
  sessionId: 'session-1' as SessionId,
  ordinal: 0,
  name: 'agent',
  status: 'completed',
  ...fields,
});

const QUIET = { hasOpenQuestion: false, isTurnLive: false, hasActiveChild: false };

describe('isAgentFinished', () => {
  it('finishes an agent whose last turn succeeded with nothing waiting on it', () => {
    expect(isAgentFinished({ agent: buildAgent(), ...QUIET })).toBe(true);
  });

  it('keeps it open while it asks, a turn is live or a child still works', () => {
    const agent = buildAgent();
    expect(isAgentFinished({ agent, ...QUIET, hasOpenQuestion: true })).toBe(false);
    expect(isAgentFinished({ agent, ...QUIET, isTurnLive: true })).toBe(false);
    expect(isAgentFinished({ agent, ...QUIET, hasActiveChild: true })).toBe(false);
  });

  it('never finishes a failed, running or queued agent on its own', () => {
    expect(isAgentFinished({ agent: buildAgent({ status: 'failed' }), ...QUIET })).toBe(false);
    expect(isAgentFinished({ agent: buildAgent({ status: 'running' }), ...QUIET })).toBe(false);
    expect(isAgentFinished({ agent: buildAgent({ status: 'pending' }), ...QUIET })).toBe(false);
  });

  it('finishes an agent you closed and a resolver whose work settled', () => {
    expect(
      isAgentFinished({ agent: buildAgent({ status: 'failed', doneAt: DONE_AT }), ...QUIET }),
    ).toBe(true);
    expect(
      isAgentFinished({
        agent: buildAgent({ status: 'failed' }),
        ...QUIET,
        isResolverSettled: true,
      }),
    ).toBe(true);
  });
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
  it('treats starting, running and blocked turns as live', () => {
    const at = DONE_AT;
    expect(isTurnStateLive({ turnState: { kind: 'starting', startedAt: at } })).toBe(true);
    expect(isTurnStateLive({ turnState: { kind: 'idle', lastActivityAt: at } })).toBe(false);
    expect(isTurnStateLive({ turnState: null })).toBe(false);
  });
});
