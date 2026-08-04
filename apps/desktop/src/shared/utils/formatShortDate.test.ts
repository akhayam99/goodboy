import { describe, expect, it, vi } from 'vitest';
import { formatShortDate } from './formatShortDate';

const ISO = '2026-07-29T11:49:00';

describe('formatShortDate', () => {
  it('renders day, short month, and year in English', () => {
    expect(formatShortDate({ iso: ISO })).toBe('Jul 29, 2026');
  });

  it('pins the Intl locale to en-US', () => {
    const original = Intl.DateTimeFormat;
    const spy = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation((...args) => new original(...args));
    formatShortDate({ iso: ISO });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });
});
