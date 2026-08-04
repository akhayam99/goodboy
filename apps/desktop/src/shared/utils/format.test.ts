import { describe, expect, it, vi } from 'vitest';
import {
  formatAbsoluteDate,
  formatClockTime,
  formatCompactDateTime,
  formatInteger,
  formatShortDate,
  formatShortDayMonth,
  formatWeekday,
} from './format';

const ISO = '2026-07-29T11:49:00';

describe('formatAbsoluteDate', () => {
  it('renders the English long-month date regardless of runtime locale', () => {
    expect(formatAbsoluteDate({ iso: ISO })).toBe('July 29, 2026');
  });

  it('pins the Intl locale to en-US', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    formatAbsoluteDate({ iso: ISO });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatAbsoluteDate({ iso: 'not-a-date' })).toBe('');
  });
});

describe('formatShortDate', () => {
  it('renders day, short month, and year in English', () => {
    expect(formatShortDate({ iso: ISO })).toBe('Jul 29, 2026');
  });

  it('pins the Intl locale to en-US', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    formatShortDate({ iso: ISO });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });
});

describe('formatShortDayMonth', () => {
  it('renders day and short month only, no year', () => {
    expect(formatShortDayMonth({ iso: ISO })).toBe('Jul 29');
  });

  it('pins the Intl locale to en-US', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    formatShortDayMonth({ iso: ISO });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });
});

describe('formatWeekday', () => {
  it('renders the English weekday name', () => {
    expect(formatWeekday({ iso: ISO })).toBe('Wednesday');
  });

  it('pins the Intl locale to en-US', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    formatWeekday({ iso: ISO });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });
});

describe('formatClockTime', () => {
  it('renders 2-digit hour, minute, and second with an AM/PM marker', () => {
    expect(formatClockTime({ iso: ISO })).toBe('11:49:00 AM');
  });

  it('pins the Intl locale to en-US', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    formatClockTime({ iso: ISO });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });

  it('accepts an epoch millisecond number', () => {
    expect(formatClockTime({ iso: new Date(ISO).getTime() })).toBe('11:49:00 AM');
  });
});

describe('formatCompactDateTime', () => {
  it('renders short month, day, hour, and minute with no year', () => {
    expect(formatCompactDateTime({ iso: ISO })).toBe('Jul 29, 11:49 AM');
  });

  it('pins the Intl locale to en-US', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    formatCompactDateTime({ iso: ISO });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });
});

describe('formatInteger', () => {
  it('groups thousands with a comma', () => {
    expect(formatInteger(1_234_567)).toBe('1,234,567');
  });

  it('pins Number.toLocaleString to en-US', () => {
    const spy = vi.spyOn(Number.prototype, 'toLocaleString');
    formatInteger(1234);
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });
});
