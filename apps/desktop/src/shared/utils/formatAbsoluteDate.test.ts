import { describe, expect, it, vi } from 'vitest';
import { formatAbsoluteDate } from './formatAbsoluteDate';

const ISO = '2026-07-29T11:49:00';

describe('formatAbsoluteDate', () => {
  it('renders the English long-month date regardless of runtime locale', () => {
    expect(formatAbsoluteDate({ iso: ISO })).toBe('July 29, 2026');
  });

  it('pins the Intl locale to en-US', () => {
    const original = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
      ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
    ) {
      return new original(...args);
    } as never);
    formatAbsoluteDate({ iso: ISO });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatAbsoluteDate({ iso: 'not-a-date' })).toBe('');
  });
});
