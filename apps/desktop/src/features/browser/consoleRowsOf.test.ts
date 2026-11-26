import { describe, expect, it } from 'vitest';
import { consoleRowsOf } from './consoleRowsOf';
import type { BrowserConsoleEntry } from './types';

const entry = (over: Partial<BrowserConsoleEntry> & Pick<BrowserConsoleEntry, 'seq'>) =>
  ({
    kind: 'console',
    level: 'log',
    text: 'ready',
    source: null,
    method: null,
    status: null,
    network: null,
    error: null,
    ...over,
  }) satisfies BrowserConsoleEntry;

const ENTRIES: ReadonlyArray<BrowserConsoleEntry> = [
  entry({ seq: 1, text: 'checkout ready' }),
  entry({ seq: 2, level: 'warn', text: 'slow ledger-core call', source: 'ledger.js:4' }),
  entry({ seq: 3, level: 'error', text: 'payments-api refused' }),
  entry({ seq: 4, level: 'info', text: 'notify-relay connected' }),
  entry({ seq: 5, kind: 'network', level: 'info', text: '/api/orders', method: 'GET' }),
  entry({
    seq: 6,
    kind: 'network',
    level: 'error',
    text: '/api/payments',
    method: 'POST',
    status: 502,
  }),
];

const seqsOf = (params: Parameters<typeof consoleRowsOf>[0]) =>
  consoleRowsOf(params).map((row) => row.seq);

describe('consoleRowsOf', () => {
  it('keeps only the rows of the chosen kind', () => {
    expect(seqsOf({ entries: ENTRIES, kind: 'console', level: 'all', query: '' })).toEqual([
      1, 2, 3, 4,
    ]);
    expect(seqsOf({ entries: ENTRIES, kind: 'network', level: 'all', query: '' })).toEqual([5, 6]);
  });

  it('filters by level and folds log into info', () => {
    expect(seqsOf({ entries: ENTRIES, kind: 'console', level: 'error', query: '' })).toEqual([3]);
    expect(seqsOf({ entries: ENTRIES, kind: 'console', level: 'warn', query: '' })).toEqual([2]);
    expect(seqsOf({ entries: ENTRIES, kind: 'console', level: 'info', query: '' })).toEqual([1, 4]);
    expect(seqsOf({ entries: ENTRIES, kind: 'network', level: 'error', query: '' })).toEqual([6]);
  });

  it('searches text, source, method and status by every word', () => {
    expect(seqsOf({ entries: ENTRIES, kind: 'console', level: 'all', query: 'LEDGER' })).toEqual([
      2,
    ]);
    expect(
      seqsOf({ entries: ENTRIES, kind: 'console', level: 'all', query: 'ledger.js slow' }),
    ).toEqual([2]);
    expect(seqsOf({ entries: ENTRIES, kind: 'network', level: 'all', query: 'post 502' })).toEqual([
      6,
    ]);
    expect(seqsOf({ entries: ENTRIES, kind: 'console', level: 'all', query: 'nothing' })).toEqual(
      [],
    );
  });

  it('shows thrown errors and rejections in the console, a request error only as its request', () => {
    const entries: ReadonlyArray<BrowserConsoleEntry> = [
      ...ENTRIES,
      entry({
        seq: 7,
        kind: 'error',
        level: 'error',
        text: 'Uncaught TypeError: total is undefined',
        error: { origin: 'uncaught', stack: 'at checkout.js:40:3', requestId: null, at: null },
      }),
      entry({
        seq: 8,
        kind: 'error',
        level: 'error',
        text: 'POST /api/payments 502',
        error: { origin: 'request', stack: null, requestId: 'r6', at: null },
      }),
      entry({
        seq: 9,
        kind: 'error',
        level: 'error',
        text: 'Unhandled rejection: payment declined',
        error: { origin: 'rejection', stack: null, requestId: null, at: null },
      }),
    ];

    expect(seqsOf({ entries, kind: 'console', level: 'all', query: '' })).toEqual([
      1, 2, 3, 4, 7, 9,
    ]);
    expect(seqsOf({ entries, kind: 'console', level: 'error', query: '' })).toEqual([3, 7, 9]);
    expect(seqsOf({ entries, kind: 'network', level: 'all', query: '' })).toEqual([5, 6]);
  });

  it('combines the level and the search', () => {
    expect(seqsOf({ entries: ENTRIES, kind: 'console', level: 'error', query: 'ledger' })).toEqual(
      [],
    );
  });
});
