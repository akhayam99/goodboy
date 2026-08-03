import { describe, expect, it } from 'vitest';
import { resolverThreadTally } from './resolverThreadTally';
import type {
  ResolverThreadSettlement,
  ResolverThreadSettlementKind,
} from './resolverThreadSettlements';

const settlement = ({
  threadId,
  kind,
  isClosed = false,
}: {
  readonly threadId: string;
  readonly kind: ResolverThreadSettlementKind;
  readonly isClosed?: boolean;
}): ResolverThreadSettlement => ({
  threadId,
  kind,
  commitSha: kind === 'resolved' ? 'abc1234' : null,
  reason: kind === 'wontfix' ? 'intentional' : null,
  reply: null,
  isQueued: false,
  isClosed,
});

describe('resolverThreadTally', () => {
  it('counts a closed thread apart from the ones that need you', () => {
    const tally = resolverThreadTally({
      settlements: [
        settlement({ threadId: 'PRRT_1', kind: 'open', isClosed: true }),
        settlement({ threadId: 'PRRT_2', kind: 'open' }),
      ],
    });

    expect(tally.open).toBe(1);
    expect(tally.closed).toBe(1);
    expect(tally.total).toBe(2);
  });

  it('keeps the verdict of a closed thread in its own bucket', () => {
    const tally = resolverThreadTally({
      settlements: [
        settlement({ threadId: 'PRRT_1', kind: 'resolved', isClosed: true }),
        settlement({ threadId: 'PRRT_2', kind: 'wontfix', isClosed: true }),
      ],
    });

    expect(tally.resolved).toBe(1);
    expect(tally.wontfix).toBe(1);
    expect(tally.settled).toBe(2);
    expect(tally.closed).toBe(0);
  });

  it('counts only what a push would actually close', () => {
    const tally = resolverThreadTally({
      settlements: [
        settlement({ threadId: 'PRRT_1', kind: 'resolved', isClosed: true }),
        settlement({ threadId: 'PRRT_2', kind: 'wontfix' }),
        settlement({ threadId: 'PRRT_3', kind: 'open' }),
      ],
    });

    expect(tally.settled).toBe(2);
    expect(tally.closable).toBe(1);
  });

  it('counts only the fixes a batch could still take', () => {
    const tally = resolverThreadTally({
      settlements: [
        settlement({ threadId: 'PRRT_1', kind: 'resolved', isClosed: true }),
        settlement({ threadId: 'PRRT_2', kind: 'resolved' }),
      ],
    });

    expect(tally.resolved).toBe(2);
    expect(tally.pushable).toBe(1);
  });

  it('leaves an untouched agent counting exactly as its verdicts read', () => {
    const tally = resolverThreadTally({
      settlements: [
        settlement({ threadId: 'PRRT_1', kind: 'resolved' }),
        settlement({ threadId: 'PRRT_2', kind: 'open' }),
      ],
    });

    expect(tally.closed).toBe(0);
    expect(tally.closable).toBe(tally.settled);
    expect(tally.pushable).toBe(tally.resolved);
    expect(tally.isMixed).toBe(true);
  });
});
