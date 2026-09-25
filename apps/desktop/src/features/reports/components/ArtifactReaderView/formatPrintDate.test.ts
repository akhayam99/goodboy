import { describe, expect, it } from 'vitest';
import { formatPrintDate } from './formatPrintDate';

const ISO = '2026-09-15T10:00:00';

describe('formatPrintDate', () => {
  it('spells out the month and carries the year, so paper is never ambiguous', () => {
    expect(formatPrintDate({ iso: ISO })).toBe('September 15, 2026 at 10:00 AM');
  });

  it('keeps the year for a date in another year', () => {
    expect(formatPrintDate({ iso: '2024-01-02T23:45:00' })).toContain('2024');
  });

  it('returns nothing for a value that is not a date', () => {
    expect(formatPrintDate({ iso: 'not a date' })).toBe('');
  });
});
