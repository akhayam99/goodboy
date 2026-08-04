import { describe, expect, it, vi } from 'vitest';
import { formatCompactDateTime } from './formatCompactDateTime';

const ISO = '2026-07-29T11:49:00';

describe('formatCompactDateTime', () => {
  it('renders short month, day, hour, and minute with no year', () => {
    expect(formatCompactDateTime({ iso: ISO })).toBe('Jul 29, 11:49 AM');
  });

  it('pins the Intl locale to en-US', () => {
    const original = Intl.DateTimeFormat;
    const spy = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation((...args) => new original(...args));
    formatCompactDateTime({ iso: ISO });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });
});
