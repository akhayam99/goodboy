import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayKey, formatDayLabel } from './lib';

describe('dayKey', () => {
  it('returns "unknown" for an invalid date', () => {
    expect(dayKey('not-a-date')).toBe('unknown');
  });

  it('produces the same key for two times on the same calendar day', () => {
    const morning = new Date(2026, 4, 15, 8, 0, 0).toISOString();
    const evening = new Date(2026, 4, 15, 22, 0, 0).toISOString();
    expect(dayKey(morning)).toBe(dayKey(evening));
  });

  it('produces different keys for different calendar days', () => {
    const d1 = new Date(2026, 4, 15, 12, 0, 0).toISOString();
    const d2 = new Date(2026, 4, 16, 12, 0, 0).toISOString();
    expect(dayKey(d1)).not.toBe(dayKey(d2));
  });

  it('formats as year-month-day numbers', () => {
    expect(dayKey(new Date(2026, 4, 15, 12, 0, 0).toISOString())).toMatch(
      /^\d{4}-\d{1,2}-\d{1,2}$/,
    );
  });
});

describe('formatDayLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "" for an invalid date', () => {
    expect(formatDayLabel('nope')).toBe('');
  });

  it('labels the current day as "today"', () => {
    expect(formatDayLabel(new Date(2026, 4, 15, 9, 0, 0).toISOString())).toBe('today');
  });

  it('labels the prior day as "yesterday"', () => {
    expect(formatDayLabel(new Date(2026, 4, 14, 9, 0, 0).toISOString())).toBe('yesterday');
  });

  it('labels a day earlier this week with a lowercase English weekday', () => {
    const iso = new Date(2026, 4, 12, 9, 0, 0).toISOString();
    expect(formatDayLabel(iso)).toBe('tuesday');
  });

  it('labels an older day with a lowercase English short date', () => {
    const label = formatDayLabel(new Date(2026, 2, 1, 9, 0, 0).toISOString());
    expect(label).toBe('mar 1, 2026');
  });

  it('pins the Intl locale to en-US for both branches', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    formatDayLabel(new Date(2026, 4, 12, 9, 0, 0).toISOString());
    formatDayLabel(new Date(2026, 2, 1, 9, 0, 0).toISOString());
    expect(spy.mock.calls.map((call) => call[0])).toEqual(['en-US', 'en-US']);
    spy.mockRestore();
  });
});
