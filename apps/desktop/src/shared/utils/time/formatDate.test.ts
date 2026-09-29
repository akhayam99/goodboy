// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { usePinnedTimeZone } from '../../../test/usePinnedTimeZone';
import { formatDate } from './formatDate';

usePinnedTimeZone({ timeZone: 'America/New_York' });

describe('formatDate', () => {
  it('adds the year to the day and month', () => {
    expect(formatDate({ at: '2026-09-29T12:00:00Z' })).toBe('Sep 29, 2026');
  });

  it('follows the local day across a year boundary', () => {
    expect(formatDate({ at: '2027-01-01T03:00:00Z' })).toBe('Dec 31, 2026');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatDate({ at: 'nope' })).toBe('');
  });
});
