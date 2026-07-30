import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { resolverActions } from './resolverActions';

const SESSION_ID = 'session-1' as SessionId;

const agentWith = (overrides: Partial<Agent> = {}): Agent =>
  ({
    id: 'agent-1' as AgentId,
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'resolver',
    status: 'completed',
    sourceThreadId: 'PRRT_1',
    ...overrides,
  }) as Agent;

const base = {
  agent: agentWith(),
  turnState: undefined,
  commitSha: 'abc1234',
  queuedThreadIds: [] as ReadonlyArray<string>,
  prNumber: 7,
};

describe('resolverActions', () => {
  it('offers push then queue for a committed resolver', () => {
    const actions = resolverActions({ ...base, status: 'committed' });

    expect(actions.map((action) => action.kind)).toEqual(['push', 'queue']);
    expect(actions[0]?.label).toBe('Push & resolve');
    expect(actions.every((action) => action.isEnabled)).toBe(true);
  });

  it('turns push into an immediate push and offers dequeue once queued', () => {
    const actions = resolverActions({
      ...base,
      status: 'committed',
      queuedThreadIds: ['PRRT_1'],
    });

    expect(actions.map((action) => action.kind)).toEqual(['dequeue', 'push']);
    expect(actions[1]?.label).toBe('Push now');
  });

  it('keeps push disabled without a commit to push', () => {
    const actions = resolverActions({ ...base, status: 'committed', commitSha: null });

    expect(actions.find((action) => action.kind === 'push')?.isEnabled).toBe(false);
    expect(actions.find((action) => action.kind === 'queue')?.isEnabled).toBe(false);
  });

  it('requires an explanation to close a thread without a fix', () => {
    const wontfix = resolverActions({ ...base, status: 'wontfix' });
    const analyzed = resolverActions({ ...base, status: 'analyzed' });

    expect(wontfix.map((action) => action.kind)).toEqual(['explain']);
    expect(wontfix[0]?.reason).toBe('required');
    expect(analyzed.map((action) => action.kind)).toEqual(['proceed', 'explain']);
  });

  it('exposes force close while the resolver runs', () => {
    const actions = resolverActions({
      ...base,
      agent: agentWith({ status: 'running' }),
      status: 'running',
    });

    expect(actions.map((action) => action.kind)).toEqual(['forceClose']);
    expect(actions[0]?.role).toBe('danger');
  });

  it('exposes a manual resolve on a stuck resolver but not mid turn', () => {
    const stuck = resolverActions({ ...base, status: 'awaiting' });
    const busy = resolverActions({
      ...base,
      status: 'awaiting',
      turnState: { kind: 'running' } as never,
    });

    expect(stuck.map((action) => action.kind)).toEqual(['continue', 'forceResolve']);
    expect(stuck[1]?.reason).toBe('optional');
    expect(busy.map((action) => action.kind)).toEqual(['continue']);
  });

  it('offers nothing once the thread is resolved', () => {
    expect(resolverActions({ ...base, status: 'resolved' })).toEqual([]);
  });

  it('never offers a manual resolve without a thread to resolve', () => {
    const actions = resolverActions({
      ...base,
      agent: agentWith({ sourceThreadId: undefined }),
      status: 'done',
    });

    expect(actions).toEqual([]);
  });
});
