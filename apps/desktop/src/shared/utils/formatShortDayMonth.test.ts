import { describe, expect, it, vi } from 'vitest';
import { formatShortDayMonth } from './formatShortDayMonth';

const ISO = '2026-07-29T11:49:00';

describe('formatShortDayMonth', () => {
  it('renders day and short month only, no year', () => {
    expect(formatShortDayMonth({ iso: ISO })).toBe('Jul 29');
  });

  it('pins the Intl locale to en-US', () => {
    const original = Intl.DateTimeFormat;
    const spy = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation((...args) => new original(...args));
    formatShortDayMonth({ iso: ISO });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });
});
