// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { usePinnedTimeZone } from '../../../test/usePinnedTimeZone';
import { formatWeekday } from './formatWeekday';

usePinnedTimeZone({ timeZone: 'Europe/Rome' });

describe('formatWeekday', () => {
  it('spells the weekday out by default', () => {
    expect(formatWeekday({ at: '2026-09-29T12:00:00Z' })).toBe('Tuesday');
  });

  it('shortens it on request', () => {
    expect(formatWeekday({ at: '2026-09-29T12:00:00Z', isShort: true })).toBe('Tue');
  });

  it('follows the local day', () => {
    expect(formatWeekday({ at: '2026-09-29T22:30:00Z' })).toBe('Wednesday');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatWeekday({ at: 'nope' })).toBe('');
  });
});
