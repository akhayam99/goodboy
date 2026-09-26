import { describe, expect, it } from 'vitest';
import { formatPrintDate } from './formatPrintDate';

const ISO = '2026-09-15T10:00:00';

describe('formatPrintDate', () => {
  it('abbreviates the month and carries the year, so the eyebrow stays one line', () => {
    expect(formatPrintDate({ iso: ISO })).toBe('Sep 15, 2026');
  });

  it('keeps the year for a date in another year', () => {
    expect(formatPrintDate({ iso: '2024-01-02T23:45:00' })).toContain('2024');
  });

  it('returns nothing for a value that is not a date', () => {
    expect(formatPrintDate({ iso: 'not a date' })).toBe('');
  });
});
