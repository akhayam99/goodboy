import { describe, expect, it, vi } from 'vitest';
import {
  formatAbsoluteDateTime,
  formatAdaptiveAge,
  formatRelativeAge,
  formatRelativeDuration,
} from './relativeDate';

const iso = (ms: number) => new Date(ms).toISOString();
const NOW = 1_700_000_000_000;

describe('formatRelativeDuration', () => {
  it('returns seconds for < 60s', () => {
    expect(formatRelativeDuration(iso(NOW - 45_000), iso(NOW))).toBe('45s');
  });

  it('returns 0s for same timestamp', () => {
    expect(formatRelativeDuration(iso(NOW), iso(NOW))).toBe('0s');
  });

  it('returns minutes for 60s–3599s', () => {
    expect(formatRelativeDuration(iso(NOW - 90_000), iso(NOW))).toBe('1m');
    expect(formatRelativeDuration(iso(NOW - 3540_000), iso(NOW))).toBe('59m');
  });

  it('returns hours for 1h–23h', () => {
    expect(formatRelativeDuration(iso(NOW - 3_600_000), iso(NOW))).toBe('1h');
    expect(formatRelativeDuration(iso(NOW - 82_800_000), iso(NOW))).toBe('23h');
  });

  it('returns days for >= 24h', () => {
    expect(formatRelativeDuration(iso(NOW - 86_400_000), iso(NOW))).toBe('1d');
    expect(formatRelativeDuration(iso(NOW - 7 * 86_400_000), iso(NOW))).toBe('7d');
  });

  it('clamps negative diff to 0s', () => {
    expect(formatRelativeDuration(iso(NOW + 10_000), iso(NOW))).toBe('0s');
  });

  it('uses Date.now() when toIso omitted', () => {
    const result = formatRelativeDuration(new Date(Date.now() - 120_000).toISOString());
    expect(result).toBe('2m');
  });

  it('returns empty string for invalid fromIso', () => {
    expect(formatRelativeDuration('not-a-date', iso(NOW))).toBe('');
  });

  it('returns empty string for invalid toIso', () => {
    expect(formatRelativeDuration(iso(NOW), 'garbage')).toBe('');
  });
});

describe('formatRelativeAge', () => {
  it('returns an empty string for an invalid timestamp', () => {
    expect(formatRelativeAge({ fromIso: 'nope', nowMs: NOW })).toBe('');
  });

  it('keeps the comment-thread ladder: just now, minutes, hours, days', () => {
    expect(formatRelativeAge({ fromIso: iso(NOW - 20_000), nowMs: NOW })).toBe('just now');
    expect(formatRelativeAge({ fromIso: iso(NOW - 5 * 60_000), nowMs: NOW })).toBe('5m ago');
    expect(formatRelativeAge({ fromIso: iso(NOW - 2 * 3_600_000), nowMs: NOW })).toBe('2h ago');
    expect(formatRelativeAge({ fromIso: iso(NOW - 3 * 86_400_000), nowMs: NOW })).toBe('3d ago');
  });
});

const at = (year: number, month: number, day: number, hour: number, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();

describe('formatAdaptiveAge', () => {
  it('returns "just now" under a minute', () => {
    expect(
      formatAdaptiveAge({ iso: at(2026, 8, 5, 14, 0), nowMs: at(2026, 8, 5, 14, 0) + 30_000 }),
    ).toBe('just now');
  });

  it('counts minutes then hours within the same calendar day', () => {
    const now = at(2026, 8, 5, 14, 0);
    expect(formatAdaptiveAge({ iso: at(2026, 8, 5, 13, 55), nowMs: now })).toBe('5m ago');
    expect(formatAdaptiveAge({ iso: at(2026, 8, 5, 13, 1), nowMs: now })).toBe('59m ago');
    expect(formatAdaptiveAge({ iso: at(2026, 8, 5, 11, 0), nowMs: now })).toBe('3h ago');
  });

  it('stays on the hour rung for a 20 hour age that never crossed midnight', () => {
    expect(formatAdaptiveAge({ iso: at(2026, 8, 5, 0, 30), nowMs: at(2026, 8, 5, 20, 30) })).toBe(
      '20h ago',
    );
  });

  it('says "yesterday" for the previous calendar day even when only hours old', () => {
    expect(formatAdaptiveAge({ iso: at(2026, 8, 4, 22, 0), nowMs: at(2026, 8, 5, 1, 0) })).toBe(
      'yesterday',
    );
    expect(formatAdaptiveAge({ iso: at(2026, 8, 4, 9, 0), nowMs: at(2026, 8, 5, 14, 0) })).toBe(
      'yesterday',
    );
  });

  it('drops to a lowercase day-then-month past yesterday, with no day-count rung', () => {
    expect(formatAdaptiveAge({ iso: at(2026, 8, 2, 12, 0), nowMs: at(2026, 8, 5, 12, 0) })).toBe(
      '2 aug',
    );
    expect(formatAdaptiveAge({ iso: at(2026, 8, 1, 12, 0), nowMs: at(2026, 8, 5, 12, 0) })).toBe(
      '1 aug',
    );
  });

  it('carries the year for a previous calendar year, still day-then-month', () => {
    expect(formatAdaptiveAge({ iso: at(2025, 12, 12, 12, 0), nowMs: at(2026, 1, 5, 12, 0) })).toBe(
      '12 dec 2025',
    );
  });

  it('prefers "yesterday" over the year rung across a new year boundary', () => {
    expect(formatAdaptiveAge({ iso: at(2025, 12, 31, 22, 0), nowMs: at(2026, 1, 1, 9, 0) })).toBe(
      'yesterday',
    );
    expect(formatAdaptiveAge({ iso: at(2025, 12, 30, 22, 0), nowMs: at(2026, 1, 1, 9, 0) })).toBe(
      '30 dec 2025',
    );
  });

  it('returns an empty string for an invalid timestamp', () => {
    expect(formatAdaptiveAge({ iso: 'not-a-date' })).toBe('');
  });
});

describe('formatAbsoluteDateTime', () => {
  it('formats a locale-aware absolute date and time', () => {
    expect(
      formatAbsoluteDateTime({
        iso: '2026-07-30T00:51:00',
        locale: 'en-GB',
      }),
    ).toBe('30 Jul 2026, 00:51');
  });

  it('returns an empty string for an invalid timestamp', () => {
    expect(formatAbsoluteDateTime({ iso: 'not-a-date', locale: 'en-GB' })).toBe('');
  });

  it('defaults to en-US when no locale is given', () => {
    expect(formatAbsoluteDateTime({ iso: '2026-07-29T11:49:00' })).toBe('Jul 29, 2026, 11:49');
  });

  it('pins the Intl locale to en-US when the caller omits it', () => {
    const original = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
      ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
    ) {
      return new original(...args);
    } as never);
    formatAbsoluteDateTime({ iso: '2026-07-29T11:49:00' });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });
});
