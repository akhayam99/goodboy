import { describe, expect, it, vi } from 'vitest';
import { formatCardTime } from './format-card-time';

describe('formatCardTime', () => {
  it('renders ISO timestamps as HH:MM:SS', () => {
    const output = formatCardTime('2026-05-14T09:30:45');
    expect(output).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it('includes hour, minute, and second fields', () => {
    const output = formatCardTime('2026-05-14T23:59:59');
    expect(output).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it('pins the Intl locale to en-US', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    formatCardTime('2026-05-14T09:30:45');
    expect(spy.mock.calls[0]?.[0]).toBe('en-US');
    spy.mockRestore();
  });
});
