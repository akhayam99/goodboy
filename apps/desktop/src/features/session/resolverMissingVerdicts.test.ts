import { describe, expect, it } from 'vitest';
import { resolverMissingVerdicts } from './resolverMissingVerdicts';
import type { ResolverStatus } from './resolver-linkage';
import type {
  ResolverThreadSettlement,
  ResolverThreadSettlementKind,
} from './resolverThreadSettlements';

const settlement = (
  threadId: string,
  kind: ResolverThreadSettlementKind,
  isClosed = false,
): ResolverThreadSettlement => ({
  threadId,
  kind,
  commitSha: kind === 'resolved' ? 'abc1234' : null,
  reason: null,
  reply: null,
  isQueued: false,
  isClosed,
});

const detect = ({
  settlements,
  status = 'awaiting',
  isBusy = false,
}: {
  readonly settlements: ReadonlyArray<ResolverThreadSettlement>;
  readonly status?: ResolverStatus;
  readonly isBusy?: boolean;
}) => resolverMissingVerdicts({ settlements, status, isBusy });

describe('resolverMissingVerdicts', () => {
  it('names the one thread the agent left without an outcome', () => {
    const missing = detect({ settlements: [settlement('PRRT_1', 'open')] });

    expect(missing?.threadIds).toEqual(['PRRT_1']);
    expect(missing?.sentence).toContain('stopped without saying what to do on this thread');
    expect(missing?.actionLabel).toBe('Ask for the verdict');
  });

  it('counts the silent threads against the ones it did report', () => {
    const missing = detect({
      settlements: [
        settlement('PRRT_1', 'resolved'),
        settlement('PRRT_2', 'open'),
        settlement('PRRT_3', 'open'),
      ],
    });

    expect(missing?.threadIds).toEqual(['PRRT_2', 'PRRT_3']);
    expect(missing?.sentence).toContain('2 of its 3 threads');
    expect(missing?.actionLabel).toBe('Ask for the 2 verdicts');
  });

  it('stays quiet while the agent is still working on it', () => {
    expect(detect({ settlements: [settlement('PRRT_1', 'open')], status: 'running' })).toBeNull();
    expect(detect({ settlements: [settlement('PRRT_1', 'open')], status: 'pending' })).toBeNull();
    expect(detect({ settlements: [settlement('PRRT_1', 'open')], isBusy: true })).toBeNull();
  });

  it('stays quiet when every thread carries an outcome or is already closed', () => {
    expect(detect({ settlements: [settlement('PRRT_1', 'wontfix')] })).toBeNull();
    expect(detect({ settlements: [settlement('PRRT_1', 'open', true)] })).toBeNull();
    expect(detect({ settlements: [] })).toBeNull();
  });
});
