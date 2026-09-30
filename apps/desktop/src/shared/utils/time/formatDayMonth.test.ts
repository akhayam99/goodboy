// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { usePinnedTimeZone } from '../../../test/usePinnedTimeZone';
import { formatDayMonth } from './formatDayMonth';

usePinnedTimeZone({ timeZone: 'Pacific/Auckland' });

describe('formatDayMonth', () => {
  it('puts the short month first, like Sep 29', () => {
    expect(formatDayMonth({ at: '2026-09-29T00:00:00Z' })).toBe('Sep 29');
    expect(formatDayMonth({ at: '2026-01-05T00:00:00Z' })).toBe('Jan 5');
  });

  it('follows the local day, not the UTC day', () => {
    expect(formatDayMonth({ at: '2026-09-29T20:00:00Z' })).toBe('Sep 30');
  });

  it('accepts an epoch millisecond number', () => {
    expect(formatDayMonth({ at: Date.UTC(2026, 8, 29, 0, 0) })).toBe('Sep 29');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatDayMonth({ at: 'nope' })).toBe('');
  });
});
