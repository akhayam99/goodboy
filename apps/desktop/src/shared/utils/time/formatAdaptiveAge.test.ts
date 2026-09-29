// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { usePinnedTimeZone } from '../../../test/usePinnedTimeZone';
import { formatAdaptiveAge } from './formatAdaptiveAge';

usePinnedTimeZone({ timeZone: 'Europe/Rome' });

const at = (year: number, month: number, day: number, hour: number, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();

describe('formatAdaptiveAge', () => {
  it('returns "just now" under a minute', () => {
    expect(
      formatAdaptiveAge({ at: at(2026, 8, 5, 14, 0), now: at(2026, 8, 5, 14, 0) + 30_000 }),
    ).toBe('just now');
  });

  it('counts minutes then hours within the same calendar day', () => {
    const now = at(2026, 8, 5, 14, 0);
    expect(formatAdaptiveAge({ at: at(2026, 8, 5, 13, 55), now })).toBe('5m ago');
    expect(formatAdaptiveAge({ at: at(2026, 8, 5, 13, 1), now })).toBe('59m ago');
    expect(formatAdaptiveAge({ at: at(2026, 8, 5, 11, 0), now })).toBe('3h ago');
  });

  it('stays on the hour rung for a 20 hour age that never crossed midnight', () => {
    expect(formatAdaptiveAge({ at: at(2026, 8, 5, 0, 30), now: at(2026, 8, 5, 20, 30) })).toBe(
      '20h ago',
    );
  });

  it('says "yesterday" for the previous calendar day even when only hours old', () => {
    expect(formatAdaptiveAge({ at: at(2026, 8, 4, 22, 0), now: at(2026, 8, 5, 1, 0) })).toBe(
      'yesterday',
    );
  });

  it('drops to the day-month style past yesterday, like every other date', () => {
    expect(formatAdaptiveAge({ at: at(2026, 8, 2, 12, 0), now: at(2026, 8, 5, 12, 0) })).toBe(
      'Aug 2',
    );
  });

  it('carries the year for a previous calendar year', () => {
    expect(formatAdaptiveAge({ at: at(2025, 12, 12, 12, 0), now: at(2026, 1, 5, 12, 0) })).toBe(
      'Dec 12, 2025',
    );
  });

  it('prefers "yesterday" over the year rung across a new year boundary', () => {
    expect(formatAdaptiveAge({ at: at(2025, 12, 31, 22, 0), now: at(2026, 1, 1, 9, 0) })).toBe(
      'yesterday',
    );
    expect(formatAdaptiveAge({ at: at(2025, 12, 30, 22, 0), now: at(2026, 1, 1, 9, 0) })).toBe(
      'Dec 30, 2025',
    );
  });

  it('returns an empty string for an invalid timestamp', () => {
    expect(formatAdaptiveAge({ at: 'not-a-date', now: at(2026, 8, 5, 12, 0) })).toBe('');
  });
});
