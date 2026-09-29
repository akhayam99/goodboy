// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { usePinnedTimeZone } from '../../../test/usePinnedTimeZone';
import { formatDateTime } from './formatDateTime';

usePinnedTimeZone({ timeZone: 'Europe/Rome' });

describe('formatDateTime', () => {
  it('shows the day, month and a 24 hour clock', () => {
    expect(formatDateTime({ at: '2026-09-29T12:30:00Z' })).toBe('Sep 29, 14:30');
  });

  it('adds the year on request', () => {
    expect(formatDateTime({ at: '2026-09-29T12:30:00Z', hasYear: true })).toBe(
      'Sep 29, 2026, 14:30',
    );
  });

  it('keeps midnight as 00', () => {
    expect(formatDateTime({ at: '2026-09-28T22:05:00Z' })).toBe('Sep 29, 00:05');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatDateTime({ at: 'nope' })).toBe('');
  });
});
