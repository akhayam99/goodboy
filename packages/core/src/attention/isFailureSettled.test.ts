import { describe, expect, it } from 'vitest';
import { isFailureSettled } from './isFailureSettled';

describe('isFailureSettled', () => {
  it('is false without a settle time', () => {
    expect(isFailureSettled({ at: 5, settledAt: null })).toBe(false);
  });

  it('is true for a failure before the settle time', () => {
    expect(isFailureSettled({ at: 4, settledAt: 5 })).toBe(true);
  });

  it('is false for a failure at or after the settle time', () => {
    expect(isFailureSettled({ at: 5, settledAt: 5 })).toBe(false);
    expect(isFailureSettled({ at: 6, settledAt: 5 })).toBe(false);
  });
});
