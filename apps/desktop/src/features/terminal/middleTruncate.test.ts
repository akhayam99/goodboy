import { describe, expect, it } from 'vitest';
import { middleTruncate } from './middleTruncate';

describe('middleTruncate', () => {
  it('keeps a title that fits', () => {
    expect(middleTruncate({ text: 'Round settlement totals', limit: 28 })).toBe(
      'Round settlement totals',
    );
  });

  it('keeps both ends of a long title around an ellipsis', () => {
    const cut = middleTruncate({
      text: 'Round settlement totals to minor units in ledger-core',
      limit: 28,
    });
    expect(cut).toBe('Round settlem…n ledger-core');
    expect(cut).toHaveLength(27);
  });

  it('never splits an emoji at the cutoff', () => {
    const cut = middleTruncate({ text: `${'a'.repeat(12)}😀${'b'.repeat(20)}`, limit: 26 });
    expect(cut).toBe(`${'a'.repeat(12)}…${'b'.repeat(12)}`);
    const tail = middleTruncate({ text: `${'a'.repeat(20)}😀${'b'.repeat(11)}`, limit: 26 });
    expect(tail).toBe(`${'a'.repeat(12)}…😀${'b'.repeat(11)}`);
    expect(() => encodeURIComponent(`${cut}${tail}`)).not.toThrow();
  });

  it('keeps a joined emoji whole', () => {
    const family = '👨‍👩‍👧';
    const cut = middleTruncate({ text: `${'a'.repeat(12)}${family}${'b'.repeat(20)}`, limit: 26 });
    expect(cut).toBe(`${'a'.repeat(12)}…${'b'.repeat(12)}`);
  });
});
