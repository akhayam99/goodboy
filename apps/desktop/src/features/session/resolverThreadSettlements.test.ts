import { describe, expect, it } from 'vitest';
import type { PendingResolution } from '@goodboy/types';
import { resolverThreadSettlements } from './resolverThreadSettlements';

const NO_PENDING: ReadonlyArray<PendingResolution> = [];

const NOTHING_CLOSED: ReadonlySet<string> = new Set();

describe('resolverThreadSettlements', () => {
  it('marks the thread the local ledger already closed', () => {
    const [settlement] = resolverThreadSettlements({
      threadIds: ['PRRT_1'],
      outcomes: {},
      pendingResolutions: NO_PENDING,
      closedThreadIds: new Set(['PRRT_1']),
    });

    expect(settlement?.kind).toBe('open');
    expect(settlement?.isClosed).toBe(true);
  });

  it('leaves a thread nobody closed to the operator', () => {
    const [settlement] = resolverThreadSettlements({
      threadIds: ['PRRT_1'],
      outcomes: {},
      pendingResolutions: NO_PENDING,
      closedThreadIds: NOTHING_CLOSED,
    });

    expect(settlement?.kind).toBe('open');
    expect(settlement?.isClosed).toBe(false);
  });

  it('closes one thread of an agent without touching its sibling', () => {
    const settlements = resolverThreadSettlements({
      threadIds: ['PRRT_1', 'PRRT_2'],
      outcomes: {
        PRRT_1: { kind: 'resolved', commitSha: 'abc1234' },
        PRRT_2: { kind: 'wontfix', reason: 'unreachable branch' },
      },
      pendingResolutions: NO_PENDING,
      closedThreadIds: new Set(['PRRT_1']),
    });

    expect(settlements[0]?.isClosed).toBe(true);
    expect(settlements[1]?.isClosed).toBe(false);
  });

  it('keeps the verdict of a closed thread readable', () => {
    const [settlement] = resolverThreadSettlements({
      threadIds: ['PRRT_1'],
      outcomes: { PRRT_1: { kind: 'wontfix', reason: 'covered elsewhere' } },
      pendingResolutions: NO_PENDING,
      closedThreadIds: new Set(['PRRT_1']),
    });

    expect(settlement?.kind).toBe('wontfix');
    expect(settlement?.reason).toBe('covered elsewhere');
    expect(settlement?.isClosed).toBe(true);
  });
});
