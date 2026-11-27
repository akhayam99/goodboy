import { describe, expect, it } from 'vitest';
import { isFailureSettled } from './isFailureSettled';

describe('isFailureSettled', () => {
  it('settles a failure that predates the merge', () => {
    expect(isFailureSettled({ at: 100, settledAt: 200 })).toBe(true);
  });

  it('keeps a failure that came after the merge', () => {
    expect(isFailureSettled({ at: 300, settledAt: 200 })).toBe(false);
  });

  it('keeps every failure while nothing is merged', () => {
    expect(isFailureSettled({ at: 100, settledAt: null })).toBe(false);
  });
});
