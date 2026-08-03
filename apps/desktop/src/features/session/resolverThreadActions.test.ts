import { describe, expect, it } from 'vitest';
import { resolverThreadActions } from './resolverThreadActions';
import type {
  ResolverThreadSettlement,
  ResolverThreadSettlementKind,
} from './resolverThreadSettlements';

const settlement = ({
  kind,
  isClosed,
}: {
  readonly kind: ResolverThreadSettlementKind;
  readonly isClosed: boolean;
}): ResolverThreadSettlement => ({
  threadId: 'PRRT_1',
  kind,
  commitSha: kind === 'resolved' ? 'abc1234' : null,
  reason: kind === 'wontfix' ? 'unreachable branch' : null,
  reply: null,
  isQueued: false,
  isClosed,
});

describe('resolverThreadActions', () => {
  it('offers nothing on a thread that is already closed', () => {
    const plan = resolverThreadActions({
      settlement: settlement({ kind: 'open', isClosed: true }),
      prNumber: 7,
      isBusy: false,
    });

    expect(plan.primary).toBeNull();
    expect(plan.overflow).toEqual([]);
  });

  it('will not batch a fix whose thread is already closed', () => {
    const plan = resolverThreadActions({
      settlement: settlement({ kind: 'resolved', isClosed: true }),
      prNumber: 7,
      isBusy: false,
    });

    expect(plan.primary).toBeNull();
  });

  it('still asks the operator to answer a thread that is open', () => {
    const plan = resolverThreadActions({
      settlement: settlement({ kind: 'open', isClosed: false }),
      prNumber: 7,
      isBusy: false,
    });

    expect(plan.primary?.kind).toBe('answer');
    expect(plan.overflow.map((action) => action.kind)).toEqual(['forceResolve']);
  });

  it('still offers to batch a fix nobody closed yet', () => {
    const plan = resolverThreadActions({
      settlement: settlement({ kind: 'resolved', isClosed: false }),
      prNumber: 7,
      isBusy: false,
    });

    expect(plan.primary?.kind).toBe('queue');
  });
});
