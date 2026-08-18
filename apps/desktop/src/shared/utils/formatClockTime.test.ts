import { describe, expect, it, vi } from 'vitest';
import { formatClockTime } from './formatClockTime';

const ISO = '2026-07-29T11:49:00';

describe('formatClockTime', () => {
  it('renders 2-digit hour and minute with an AM/PM marker, and no seconds', () => {
    expect(formatClockTime({ iso: ISO })).toBe('11:49 AM');
  });

  it('pins the Intl locale to en-US', () => {
    const original = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
      ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
    ) {
      return new original(...args);
    } as never);
    formatClockTime({ iso: ISO });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });

  it('accepts an epoch millisecond number', () => {
    expect(formatClockTime({ iso: new Date(ISO).getTime() })).toBe('11:49 AM');
  });
});
