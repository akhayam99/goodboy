// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { recentRowsOf } from './recentRowsOf';

type StreamItem = Readonly<{
  id: string;
  kind: string;
}>;

const STREAM: ReadonlyArray<StreamItem> = [
  { id: 'now', kind: 'now' },
  { id: 'today', kind: 'day' },
  { id: 'ledger-core', kind: 'row' },
  { id: 'more', kind: 'more' },
  { id: 'payments-api', kind: 'row' },
  { id: 'yesterday', kind: 'day' },
  { id: 'notify-relay', kind: 'row' },
  { id: 'acme', kind: 'row' },
];

describe('recentRowsOf', () => {
  it('keeps the stream index of each row so its rail geometry lines up', () => {
    expect(
      recentRowsOf({ items: STREAM, limit: 3 }).map(({ item, index }) => [item.id, index]),
    ).toEqual([
      ['ledger-core', 2],
      ['payments-api', 4],
      ['notify-relay', 6],
    ]);
  });

  it('returns nothing for a stream without rows', () => {
    expect(recentRowsOf({ items: STREAM.slice(0, 2), limit: 3 })).toEqual([]);
  });
});
