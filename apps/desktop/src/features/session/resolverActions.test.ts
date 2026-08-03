import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import {
  resolverActionOpensPanel,
  resolverActionPlan,
  type ResolverActionSurface,
} from './resolverActions';
import { resolverThreadTally } from './resolverThreadTally';
import type { ResolverThreadSettlement } from './resolverThreadSettlements';

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

const settlement = (
  threadId: string,
  kind: ResolverThreadSettlement['kind'],
): ResolverThreadSettlement => ({
  threadId,
  kind,
  commitSha: kind === 'resolved' ? 'abc1234' : null,
  reason: kind === 'wontfix' ? 'intentional' : null,
  reply: null,
  isQueued: false,
});

const tallyOf = (...kinds: ReadonlyArray<ResolverThreadSettlement['kind']>) =>
  resolverThreadTally({
    settlements: kinds.map((kind, index) => settlement(`PRRT_${index + 1}`, kind)),
  });

const base = {
  agent: agentWith(),
  turnState: undefined,
  commitSha: 'abc1234',
  tally: tallyOf('resolved'),
  surface: 'inspector' as ResolverActionSurface,
  queuedThreadIds: [] as ReadonlyArray<string>,
  prNumber: 7,
  isQueueStalled: false,
  hasOtherActiveResolvers: false,
};

describe('resolverActionPlan', () => {
  it('pushes and resolves when it is the last resolver standing', () => {
    const plan = resolverActionPlan({ ...base, status: 'committed' });

    expect(plan.primary?.label).toBe('Push & resolve');
    expect(plan.secondary?.label).toBe('Add to push batch');
    expect(plan.primary?.confirm).not.toBeNull();
  });

  it('prefers the batch while other resolvers are still active', () => {
    const plan = resolverActionPlan({
      ...base,
      status: 'committed',
      hasOtherActiveResolvers: true,
    });

    expect(plan.primary?.label).toBe('Add to push batch');
    expect(plan.primary?.confirm).toBeNull();
    expect(plan.secondary?.label).toBe('Push now');
  });

  it('states the batch membership and leaves only a way out', () => {
    const plan = resolverActionPlan({
      ...base,
      status: 'committed',
      queuedThreadIds: ['PRRT_1'],
    });

    expect(plan.note).toBe('In the push batch');
    expect(plan.primary).toBeNull();
    expect(plan.secondary?.label).toBe('Remove from batch');
  });

  it('keeps push disabled without a commit to push', () => {
    const plan = resolverActionPlan({
      ...base,
      status: 'committed',
      commitSha: null,
      tally: tallyOf('open'),
    });

    expect(plan.primary?.isEnabled).toBe(false);
    expect(plan.secondary?.isEnabled).toBe(false);
    expect(plan.note).toBe('no fix recorded on any thread yet');
  });

  it('enables push from a resolved outcome, never from a sha shared across threads', () => {
    const oneFixed = resolverActionPlan({
      ...base,
      status: 'committed',
      commitSha: null,
      tally: tallyOf('resolved', 'resolved'),
    });
    const noneFixed = resolverActionPlan({
      ...base,
      status: 'committed',
      commitSha: 'abc1234',
      tally: tallyOf('wontfix', 'wontfix'),
    });

    expect(oneFixed.primary?.isEnabled).toBe(true);
    expect(noneFixed.primary?.isEnabled).toBe(false);
  });

  it('requires an explanation to close a thread without a fix', () => {
    const wontfix = resolverActionPlan({ ...base, status: 'wontfix', tally: tallyOf('wontfix') });
    const analyzed = resolverActionPlan({
      ...base,
      status: 'analyzed',
      tally: tallyOf('analyzed'),
    });

    expect(wontfix.primary?.label).toBe('Post explanation & close');
    expect(wontfix.primary?.opensInspector).toBe(true);
    expect(wontfix.secondary).toBeNull();
    expect(analyzed.primary?.label).toBe('Proceed with fix');
    expect(analyzed.secondary?.label).toBe('Post & close');
  });

  it('sends a lane card of disagreeing threads to the inspector instead of one CTA', () => {
    const lane = resolverActionPlan({
      ...base,
      status: 'committed',
      surface: 'lane',
      tally: tallyOf('resolved', 'resolved', 'open'),
    });

    expect(lane.primary?.label).toBe('Review threads');
    expect(resolverActionOpensPanel({ action: lane.primary! })).toBe(true);
    expect(lane.secondary).toBeNull();
  });

  it('counts the settled threads in the inspector block and names what is left open', () => {
    const inspector = resolverActionPlan({
      ...base,
      status: 'committed',
      tally: tallyOf('resolved', 'wontfix', 'open'),
    });

    expect(inspector.primary?.label).toBe('Push & resolve 2');
    expect(inspector.secondary?.label).toBe('Add 1 to batch');
    expect(inspector.note).toBe('1 thread still needs you');
  });

  it('sends an action needing typed input to the panel', () => {
    const wontfix = resolverActionPlan({ ...base, status: 'wontfix' });
    const committed = resolverActionPlan({ ...base, status: 'committed' });

    expect(resolverActionOpensPanel({ action: wontfix.primary! })).toBe(true);
    expect(resolverActionOpensPanel({ action: committed.primary! })).toBe(false);
  });

  it('offers no forward action while working or once resolved', () => {
    const working = resolverActionPlan({
      ...base,
      agent: agentWith({ status: 'running' }),
      status: 'running',
    });
    const resolved = resolverActionPlan({ ...base, status: 'resolved' });

    expect(working.primary).toBeNull();
    expect(working.secondary).toBeNull();
    expect(working.overflow.map((action) => action.kind)).toEqual(['forceClose']);
    expect(resolved.primary).toBeNull();
    expect(resolved.overflow).toEqual([]);
  });

  it('runs a queued resolver only once the queue is stalled', () => {
    expect(resolverActionPlan({ ...base, status: 'pending' }).primary).toBeNull();
    expect(
      resolverActionPlan({ ...base, status: 'pending', isQueueStalled: true }).primary?.label,
    ).toBe('Run now');
  });

  it('offers a rerun and a manual resolve on a dead end', () => {
    const failed = resolverActionPlan({ ...base, status: 'failed' });
    const done = resolverActionPlan({ ...base, status: 'done' });

    expect(failed.primary?.label).toBe('Run again');
    expect(failed.secondary?.label).toBe('Mark resolved');
    expect(failed.overflow).toEqual([]);
    expect(done.primary?.label).toBe('Run again');
  });

  it('keeps the manual resolve in the overflow while the resolver awaits an answer', () => {
    const awaiting = resolverActionPlan({ ...base, status: 'awaiting' });
    const busy = resolverActionPlan({
      ...base,
      status: 'awaiting',
      turnState: { kind: 'running' } as never,
    });

    expect(awaiting.primary?.label).toBe('Answer in chat');
    expect(awaiting.overflow.map((action) => action.kind)).toEqual(['forceResolve']);
    expect(busy.overflow).toEqual([]);
  });

  it('never offers a manual resolve without a thread to resolve', () => {
    const plan = resolverActionPlan({
      ...base,
      agent: agentWith({ sourceThreadId: undefined }),
      status: 'done',
    });

    expect(plan.secondary).toBeNull();
    expect(plan.overflow).toEqual([]);
  });
});
