// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findById } from './findById';

type Row = { readonly id: string; readonly name: string };

const ledger: Row = { id: 'ledger-core', name: 'ledger core' };
const notify: Row = { id: 'notify-relay', name: 'notify relay' };

describe('findById', () => {
  it('returns the row the list holds, by reference', () => {
    const rows = [ledger, notify];

    expect(findById(rows, 'notify-relay')).toBe(notify);
    expect(findById(rows, 'ledger-core')).toBe(ledger);
  });

  it('returns undefined for an id the list lacks, and for a missing id', () => {
    const rows = [ledger];

    expect(findById(rows, 'payments-api')).toBeUndefined();
    expect(findById(rows, null)).toBeUndefined();
    expect(findById(rows, undefined)).toBeUndefined();
    expect(findById([], 'ledger-core')).toBeUndefined();
  });

  it('returns the first row when two rows share an id, like find does', () => {
    const later: Row = { id: 'ledger-core', name: 'later copy' };
    const rows = [ledger, notify, later];

    expect(findById(rows, 'ledger-core')).toBe(ledger);
  });

  it('follows a replaced list of the same length', () => {
    const before = [ledger, notify];
    expect(findById(before, 'ledger-core')).toBe(ledger);

    const renamed: Row = { id: 'ledger-core', name: 'ledger core audit' };
    const after = before.map((row) => (row.id === 'ledger-core' ? renamed : row));

    expect(findById(after, 'ledger-core')).toBe(renamed);
    expect(findById(before, 'ledger-core')).toBe(ledger);
  });

  it('follows a replaced list that swaps one id for another at the same length', () => {
    const before = [ledger, notify];
    expect(findById(before, 'notify-relay')).toBe(notify);

    const storefront: Row = { id: 'storefront-web', name: 'storefront web' };
    const after = [ledger, storefront];

    expect(findById(after, 'notify-relay')).toBeUndefined();
    expect(findById(after, 'storefront-web')).toBe(storefront);
  });

  it('follows a list that reorders its rows', () => {
    const before = [ledger, notify];
    expect(findById(before, 'notify-relay')).toBe(notify);

    const after = [notify, ledger];

    expect(findById(after, 'notify-relay')).toBe(notify);
    expect(findById(after, 'ledger-core')).toBe(ledger);
  });

  it('keeps separate lists apart', () => {
    const first = [ledger];
    const second = [notify];

    expect(findById(first, 'ledger-core')).toBe(ledger);
    expect(findById(second, 'ledger-core')).toBeUndefined();
    expect(findById(first, 'ledger-core')).toBe(ledger);
  });

  it('accepts readonly lists of a wider row type', () => {
    const rows: ReadonlyArray<Row & { readonly extra: number }> = [{ ...ledger, extra: 1 }];

    expect(findById(rows, 'ledger-core')?.extra).toBe(1);
  });
});
