import { describe, expect, it, vi } from 'vitest';
import { formatCardTime } from './format-card-time';

describe('formatCardTime', () => {
  it('renders ISO timestamps as HH:MM with a meridiem', () => {
    const output = formatCardTime('2026-05-14T09:30:45');
    expect(output).toMatch(/^\d{2}:\d{2}\s?(AM|PM)$/);
  });

  it('carries hour and minute only, never seconds', () => {
    const output = formatCardTime('2026-05-14T23:59:59');
    expect(output).not.toMatch(/:\d{2}:\d{2}/);
  });

  it('pins the Intl locale to en-US', () => {
    const original = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
      ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
    ) {
      return new original(...args);
    } as never);
    formatCardTime('2026-05-14T09:30:45');
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });
});
