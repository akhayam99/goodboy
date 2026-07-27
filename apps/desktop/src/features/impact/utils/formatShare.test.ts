import { describe, expect, it } from 'vitest';
import { formatShare } from './formatShare';

describe('formatShare', () => {
  it('degrades to a raw fraction under five samples', () => {
    expect(formatShare({ part: 2, total: 3, noun: 'sessions planned' })).toBe(
      '2 of 3 sessions planned',
    );
  });

  it('switches to a percentage once the sample is large enough', () => {
    expect(formatShare({ part: 3, total: 6 })).toBe('50%');
  });

  it('never reads as a percentage on an empty denominator', () => {
    expect(formatShare({ part: 0, total: 0 })).toBe('No data');
  });
});
