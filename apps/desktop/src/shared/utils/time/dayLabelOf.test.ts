// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { usePinnedTimeZone } from '../../../test/usePinnedTimeZone';
import { dayLabelOf } from './dayLabelOf';

usePinnedTimeZone({ timeZone: 'Europe/Rome' });

const at = (year: number, month: number, day: number, hour: number, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();

describe('dayLabelOf', () => {
  const now = at(2026, 11, 21, 10, 0);

  it('says Today for any hour of the same calendar day', () => {
    expect(dayLabelOf({ at: at(2026, 11, 21, 0, 5), now })).toBe('Today');
    expect(dayLabelOf({ at: at(2026, 11, 21, 9, 59), now })).toBe('Today');
  });

  it('says Yesterday for the previous calendar day, even when only hours old', () => {
    expect(dayLabelOf({ at: at(2026, 11, 20, 23, 50), now: at(2026, 11, 21, 0, 10) })).toBe(
      'Yesterday',
    );
  });

  it('writes the weekday for the rest of the week', () => {
    expect(dayLabelOf({ at: at(2026, 11, 19, 12), now })).toBe('Thursday');
    expect(dayLabelOf({ at: at(2026, 11, 15, 12), now })).toBe('Sunday');
  });

  it('writes the date past a week, with the year only for another year', () => {
    expect(dayLabelOf({ at: at(2026, 11, 14, 12), now })).toBe('Nov 14');
    expect(dayLabelOf({ at: at(2025, 11, 14, 12), now })).toBe('Nov 14, 2025');
  });

  it('lowercases the two relative words inside a sentence and keeps weekdays and dates', () => {
    expect(dayLabelOf({ at: at(2026, 11, 21, 8), now, casing: 'inline' })).toBe('today');
    expect(dayLabelOf({ at: at(2026, 11, 20, 8), now, casing: 'inline' })).toBe('yesterday');
    expect(dayLabelOf({ at: at(2026, 11, 19, 8), now, casing: 'inline' })).toBe('Thursday');
  });

  it('moves a label from Today to Yesterday when the clock passes midnight', () => {
    const commit = at(2026, 11, 21, 23, 30);
    expect(dayLabelOf({ at: commit, now: at(2026, 11, 21, 23, 59) })).toBe('Today');
    expect(dayLabelOf({ at: commit, now: at(2026, 11, 22, 0, 1) })).toBe('Yesterday');
  });

  it('returns an empty string for an invalid date', () => {
    expect(dayLabelOf({ at: 'nope', now })).toBe('');
  });
});
