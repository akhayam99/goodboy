import { describe, expect, it, vi } from 'vitest';
import { formatWeekday } from './formatWeekday';

const ISO = '2026-07-29T11:49:00';

describe('formatWeekday', () => {
  it('renders the English weekday name', () => {
    expect(formatWeekday({ iso: ISO })).toBe('Wednesday');
  });

  it('pins the Intl locale to en-US', () => {
    const original = Intl.DateTimeFormat;
    const spy = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation((...args) => new original(...args));
    formatWeekday({ iso: ISO });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });
});
