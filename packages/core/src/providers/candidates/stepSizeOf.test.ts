import { describe, expect, it } from 'vitest';
import { stepSizeOf } from './stepSizeOf';

describe('stepSizeOf', () => {
  it('reads the difficulty the Lead writes as a step size', () => {
    expect(stepSizeOf({ difficulty: 'light' })).toBe('small');
    expect(stepSizeOf({ difficulty: 'standard' })).toBe('medium');
    expect(stepSizeOf({ difficulty: 'heavy' })).toBe('large');
    expect(stepSizeOf({ difficulty: 'unknown' })).toBeNull();
    expect(stepSizeOf({ difficulty: null })).toBeNull();
  });
});
