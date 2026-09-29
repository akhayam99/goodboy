// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { impactDelta } from './impactDelta';
import { impactSummary, type SummaryPart } from './impactSummary';
import { shippedSessions } from './shippedSessions';

const text = (parts: ReadonlyArray<SummaryPart> | null): string =>
  parts === null ? '' : parts.map((part) => part.text).join('');

describe('impactSummary', () => {
  it('builds the period sentence from the numbers it has', () => {
    const parts = impactSummary({
      windowId: 'last30',
      workspaceName: 'Northwind',
      sessionCount: 42,
      mergedPullRequests: 18,
      spendText: '$312',
      workflowShare: 0.61,
    });

    expect(text(parts)).toBe(
      'In the last 30 days Goodboy ran 42 sessions in Northwind, merged 18 pull requests and spent $312. Workflows ran 61% of sessions.',
    );
    expect(parts?.filter((part) => part.isStrong).map((part) => part.text)).toEqual([
      '42 sessions',
      '18 pull requests',
      '$312',
      '61%',
    ]);
  });

  it('leaves out what was not measured instead of saying zero', () => {
    const parts = impactSummary({
      windowId: 'last7',
      workspaceName: null,
      sessionCount: 1,
      mergedPullRequests: null,
      spendText: null,
      workflowShare: null,
    });

    expect(text(parts)).toBe('In the last 7 days Goodboy ran 1 session.');
  });

  it('says nothing for a window with no sessions', () => {
    expect(
      impactSummary({
        windowId: 'all',
        workspaceName: 'Northwind',
        sessionCount: 0,
        mergedPullRequests: 0,
        spendText: null,
        workflowShare: null,
      }),
    ).toBeNull();
  });
});

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
  it('ranks sessions by merged pull requests and sums what they cost', () => {
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
        },
        {
          sessionId: payments,
          goal: 'Split payments-api refunds',
          number: 2,
          title: 'b',
          state: 'merged',
          spendUsd: 6,
        },
        {
          sessionId: payments,
          goal: 'Split payments-api refunds',
          number: 3,
          title: 'c',
          state: 'merged',
          spendUsd: null,
        },
        {
          sessionId: ledger,
          goal: 'Fix ledger rounding',
          number: 4,
          title: 'd',
          state: 'open',
          spendUsd: 1,
        },
      ],
      durations: [{ sessionId: payments, goal: 'Split payments-api refunds', value: 2.2 }],
      limit: 5,
    });

    expect(rows.map((row) => [row.sessionId, row.merged, row.spendUsd, row.hours])).toEqual([
      [payments, 2, 6, 2.2],
      [ledger, 1, 3.4, null],
    ]);
  });
});
