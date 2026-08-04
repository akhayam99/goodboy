import { describe, expect, it, vi } from 'vitest';
import { formatInteger } from './formatInteger';

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
