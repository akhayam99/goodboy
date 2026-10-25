import { describe, expect, it } from 'vitest';
import { historyStopDetailOf } from './historyStopDetailOf';

const NESTED = 'apps/web/src/domains/payments/components/Ledger/LedgerRow.tsx';

describe('historyStopDetailOf', () => {
  it('names a single conflicting file by its base name', () => {
    expect(historyStopDetailOf({ payload: { reason: 'conflict', files: [NESTED] } })).toBe(
      'Conflict in LedgerRow.tsx',
    );
  });

  it('joins two files with and and counts the rest', () => {
    const two = ['src/ledger/postings.ts', 'src/notify/relay.ts'];
    expect(historyStopDetailOf({ payload: { reason: 'conflict', files: two } })).toBe(
      'Conflict in postings.ts and relay.ts',
    );
    const five = [...two, NESTED, 'a/b/c.ts', 'a/b/d.ts'];
    expect(historyStopDetailOf({ payload: { reason: 'conflict', files: five } })).toBe(
      'Conflict in postings.ts, relay.ts and 3 more',
    );
  });

  it('says the cause when no file is known or the stop needs the owner', () => {
    expect(historyStopDetailOf({ payload: { reason: 'origin-moved' } })).toBe('Origin moved');
    expect(historyStopDetailOf({ payload: { reason: 'stuck', files: [NESTED] } })).toBe(
      'Needs you',
    );
    expect(historyStopDetailOf({ payload: { reason: 'conflict' } })).toBeNull();
    expect(historyStopDetailOf({ payload: null })).toBeNull();
  });
});
