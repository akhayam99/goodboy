import { describe, expect, it } from 'vitest';
import { msOf } from './msOf';

describe('msOf', () => {
  it('reads an ISO time', () => {
    expect(msOf({ value: '2026-10-06T09:00:00.000Z' })).toBe(
      Date.parse('2026-10-06T09:00:00.000Z'),
    );
  });

  it.each([null, undefined, '', 'not a time'])('is null for %s', (value) => {
    expect(msOf({ value })).toBeNull();
  });
});
