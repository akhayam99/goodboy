import { describe, expect, it } from 'vitest';
import { resolverTallySentence } from './resolverTallySentence';
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

describe('resolverTallySentence', () => {
  it('calls a closed thread closed instead of saying it needs you', () => {
    const sentence = resolverTallySentence({
      tally: resolverThreadTally({
        settlements: [
          settlement({ threadId: 'PRRT_1', kind: 'resolved' }),
          settlement({ threadId: 'PRRT_2', kind: 'open', isClosed: true }),
        ],
      }),
    });

    expect(sentence).toBe('1 fixed · 1 closed');
  });

  it('still ends on what the operator has left to do', () => {
    const sentence = resolverTallySentence({
      tally: resolverThreadTally({
        settlements: [
          settlement({ threadId: 'PRRT_1', kind: 'open', isClosed: true }),
          settlement({ threadId: 'PRRT_2', kind: 'open' }),
        ],
      }),
    });

    expect(sentence).toBe('1 closed · 1 needs you');
  });

  it('reads the same as before on an agent nothing closed', () => {
    const sentence = resolverTallySentence({
      tally: resolverThreadTally({
        settlements: [
          settlement({ threadId: 'PRRT_1', kind: 'resolved' }),
          settlement({ threadId: 'PRRT_2', kind: 'wontfix' }),
          settlement({ threadId: 'PRRT_3', kind: 'open' }),
        ],
      }),
    });

    expect(sentence).toBe('1 fixed · 1 no change · 1 needs you');
  });
});
