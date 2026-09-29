// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { usePinnedTimeZone } from '../../../test/usePinnedTimeZone';
import { formatIntl } from './formatIntl';

usePinnedTimeZone({ timeZone: 'Europe/Rome' });

const AT = '2026-09-29T14:30:00Z';

describe('formatIntl', () => {
  it('pins the locale to en-US whatever the machine locale is', () => {
    const original = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
      ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
    ) {
      return new original(...args);
    } as never);
    formatIntl({ at: AT, options: { month: 'short' } });
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });

  it('renders in the pinned time zone, not in UTC', () => {
    expect(formatIntl({ at: AT, options: { hour: '2-digit', minute: '2-digit' } })).toBe('16:30');
  });

  it('never counts midnight as 24', () => {
    expect(
      formatIntl({
        at: '2026-09-29T22:05:00Z',
        options: { hour: '2-digit', minute: '2-digit' },
      }),
    ).toBe('00:05');
  });

  it('returns an empty string for a date that does not exist', () => {
    expect(formatIntl({ at: 'not-a-date', options: { month: 'short' } })).toBe('');
    expect(formatIntl({ at: Number.NaN, options: { month: 'short' } })).toBe('');
  });
});
