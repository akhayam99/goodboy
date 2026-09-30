// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { usePinnedTimeZone } from '../../../test/usePinnedTimeZone';
import { formatClock } from './formatClock';

usePinnedTimeZone({ timeZone: 'Asia/Kolkata' });

describe('formatClock', () => {
  it('shows a 24 hour clock with no marker and no seconds', () => {
    expect(formatClock({ at: '2026-09-29T09:15:42Z' })).toBe('14:45');
    expect(formatClock({ at: '2026-09-29T02:00:00Z' })).toBe('07:30');
  });

  it('accepts an epoch millisecond number', () => {
    expect(formatClock({ at: Date.UTC(2026, 8, 29, 9, 15) })).toBe('14:45');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatClock({ at: 'nope' })).toBe('');
  });
});
