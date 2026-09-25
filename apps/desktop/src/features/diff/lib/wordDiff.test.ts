import { describe, expect, it } from 'vitest';
import { changedRanges } from './wordDiff';

describe('changedRanges', () => {
  it('marks only the changed middle of a paired line', () => {
    const before = '  return raw.map(Math.round);';
    const after = '  return raw.map(floorToCents);';
    const ranges = changedRanges(before, after);
    expect(before.slice(ranges?.old.start, ranges?.old.end)).toBe('Math.round');
    expect(after.slice(ranges?.new.start, ranges?.new.end)).toBe('floorToCents');
  });

  it('skips lines that share almost nothing', () => {
    expect(changedRanges('abc', 'xyz')).toBeNull();
    expect(changedRanges('same', 'same')).toBeNull();
  });
});
