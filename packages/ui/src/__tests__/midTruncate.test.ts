// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MID_TRUNCATE_KEEP, midTruncate } from '../midTruncate';

describe('midTruncate', () => {
  it('leaves a short name whole', () => {
    expect(midTruncate({ name: 'main' })).toEqual({ head: 'main', tail: '' });
    expect(midTruncate({ name: 'x'.repeat(MID_TRUNCATE_KEEP) }).tail).toBe('');
  });

  it('splits a long name into a head and its last 12 characters', () => {
    const name = 'feature/ledger-core/reconcile-open-invoices';
    const { head, tail } = midTruncate({ name });
    expect(tail).toBe(name.slice(-MID_TRUNCATE_KEEP));
    expect(`${head}${tail}`).toBe(name);
  });

  it('keeps two branches with one long prefix distinct', () => {
    const prefix = 'harborline/payments-api/migrate-invoices-to-';
    const first = midTruncate({ name: `${prefix}ledger-core-v2` });
    const second = midTruncate({ name: `${prefix}notify-relay-v2` });
    expect(first.tail).not.toBe(second.tail);
  });
});
