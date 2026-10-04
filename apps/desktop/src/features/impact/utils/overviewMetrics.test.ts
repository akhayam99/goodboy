// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { impactDelta } from './impactDelta';
import { shippedSessions } from './shippedSessions';

describe('impactDelta', () => {
  it('names the change in words, relative for counts', () => {
    expect(impactDelta({ current: 18, previous: 16, unit: 'count' })).toEqual({
      direction: 'up',
      label: 'up 13%',
      isBetter: true,
    });
  });

  it('treats a longer median as worse when lower is better', () => {
    expect(impactDelta({ current: 2, previous: 3, unit: 'hours', isLowerBetter: true })).toEqual({
      direction: 'down',
      label: 'down 1.0h',
      isBetter: true,
    });
  });

  it('has nothing to compare against for all time', () => {
    expect(impactDelta({ current: 4, previous: null, unit: 'points' })).toBeNull();
  });
});

describe('shippedSessions', () => {
  it('ranks sessions by merged pull requests and counts what each session cost once', () => {
    const payments = 'session-payments' as SessionId;
    const ledger = 'session-ledger' as SessionId;
    const rows = shippedSessions({
      entries: [
        {
          sessionId: ledger,
          goal: 'Fix ledger rounding',
          number: 1,
          title: 'a',
          state: 'merged',
          spendUsd: 3.4,
          isDeleted: false,
        },
        {
          sessionId: payments,
          goal: 'Split payments-api refunds',
          number: 2,
          title: 'b',
          state: 'merged',
          spendUsd: 6,
          isDeleted: false,
        },
        {
          sessionId: payments,
          goal: 'Split payments-api refunds',
          number: 3,
          title: 'c',
          state: 'merged',
          spendUsd: 6,
          isDeleted: false,
        },
        {
          sessionId: ledger,
          goal: 'Fix ledger rounding',
          number: 4,
          title: 'd',
          state: 'open',
          spendUsd: 1,
          isDeleted: false,
        },
      ],
      durations: [
        { sessionId: payments, goal: 'Split payments-api refunds', value: 2.2, isDeleted: false },
      ],
      limit: 5,
    });

    expect(rows.map((row) => [row.sessionId, row.merged, row.spendUsd, row.hours])).toEqual([
      [payments, 2, 6, 2.2],
      [ledger, 1, 3.4, null],
    ]);
  });
});
