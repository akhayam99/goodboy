import { describe, expect, it } from 'vitest';
import { resolverThreadDecisions } from './resolverThreadDecisions';
import type {
  ResolverThreadSettlement,
  ResolverThreadSettlementKind,
} from './resolverThreadSettlements';

const settlement = ({
  kind,
  isClosed = false,
  isQueued = false,
}: {
  readonly kind: ResolverThreadSettlementKind;
  readonly isClosed?: boolean;
  readonly isQueued?: boolean;
}): ResolverThreadSettlement => ({
  threadId: 'PRRT_1',
  kind,
  commitSha: kind === 'resolved' ? 'abc1234' : null,
  reason: kind === 'wontfix' ? 'unreachable branch' : null,
  reply: null,
  isQueued,
  isClosed,
});

const kindsOf = ({
  kind,
  isQueued = false,
  isBusy = false,
  prNumber = 7,
}: {
  readonly kind: ResolverThreadSettlementKind;
  readonly isQueued?: boolean;
  readonly isBusy?: boolean;
  readonly prNumber?: number | null;
}) =>
  resolverThreadDecisions({
    settlement: settlement({ kind, isQueued }),
    prNumber,
    isBusy,
  }).decisions.map(({ action }) => action.kind);

describe('resolverThreadDecisions', () => {
  it('leaves nothing to decide on a thread github already closed', () => {
    const plan = resolverThreadDecisions({
      settlement: settlement({ kind: 'resolved', isClosed: true }),
      prNumber: 7,
      isBusy: false,
    });

    expect(plan.decisions).toEqual([]);
    expect(plan.question).toContain('Closed on GitHub');
  });

  it('offers accept, refuse and write-your-own on a no-change verdict', () => {
    expect(kindsOf({ kind: 'wontfix' })).toEqual(['explain', 'fix', 'rework', 'custom']);
    expect(kindsOf({ kind: 'analyzed' })).toEqual(['explain', 'fix', 'rework', 'custom']);
  });

  it('recommends closing the thread the agent judged not worth a change', () => {
    const plan = resolverThreadDecisions({
      settlement: settlement({ kind: 'wontfix' }),
      prNumber: 7,
      isBusy: false,
    });
    const [first] = plan.decisions;

    expect(first?.action.kind).toBe('explain');
    expect(first?.isRecommended).toBe(true);
    expect(first?.action.confirm).not.toBeNull();
    expect(plan.question).toContain('not worth a change');
  });

  it('recommends batching a committed fix, and offers a redo with hints', () => {
    const plan = resolverThreadDecisions({
      settlement: settlement({ kind: 'resolved' }),
      prNumber: 7,
      isBusy: false,
    });

    expect(plan.decisions.map(({ action }) => action.kind)).toEqual(['queue', 'redo', 'custom']);
    expect(plan.decisions[0]?.isRecommended).toBe(true);
    expect(plan.decisions[1]?.needsNotes).toBe(true);
    expect(plan.decisions[2]?.needsNotes).toBe(true);
  });

  it('cannot batch a fix while the pull request is unknown', () => {
    const [queue] = resolverThreadDecisions({
      settlement: settlement({ kind: 'resolved' }),
      prNumber: null,
      isBusy: false,
    }).decisions;

    expect(queue?.action.isEnabled).toBe(false);
  });

  it('drops the agent-bound choices while the agent is working', () => {
    expect(kindsOf({ kind: 'wontfix', isBusy: true })).toEqual(['explain']);
    expect(kindsOf({ kind: 'resolved', isBusy: true })).toEqual(['queue']);
    expect(kindsOf({ kind: 'open', isBusy: true })).toEqual(['forceResolve']);
  });

  it('offers to take a batched fix back out', () => {
    expect(kindsOf({ kind: 'resolved', isQueued: true })).toEqual(['dequeue']);
  });

  it('says nothing was recorded on a thread with no outcome', () => {
    const plan = resolverThreadDecisions({
      settlement: settlement({ kind: 'open' }),
      prNumber: 7,
      isBusy: false,
    });

    expect(plan.question).toContain('no outcome');
    expect(plan.decisions.map(({ action }) => action.kind)).toEqual(['forceResolve', 'custom']);
  });
});
