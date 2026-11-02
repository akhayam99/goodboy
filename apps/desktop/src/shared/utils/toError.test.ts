import { describe, expect, it } from 'vitest';
import { toError } from './toError';

describe('toError', () => {
  it('returns an Error as it is', () => {
    const failure = new Error('notify-relay is down');
    expect(toError({ value: failure })).toBe(failure);
  });

  it('wraps any other value in an Error with its message', () => {
    expect(toError({ value: 'Northwind timed out' }).message).toContain('Northwind timed out');
  });
});
