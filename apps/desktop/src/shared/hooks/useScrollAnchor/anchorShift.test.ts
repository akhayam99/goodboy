import { describe, expect, it } from 'vitest';
import { anchorShift } from './anchorShift';

describe('anchorShift', () => {
  it('scrolls down by the growth of a row above the anchor', () => {
    expect(anchorShift({ savedOffset: -40, currentOffset: 1860, isHeld: false })).toBe(1900);
  });

  it('scrolls up by the shrink of a row above the anchor', () => {
    expect(anchorShift({ savedOffset: 12, currentOffset: -356, isHeld: false })).toBe(-368);
  });

  it('leaves the view alone when the anchor did not move', () => {
    expect(anchorShift({ savedOffset: 12, currentOffset: 12.3, isHeld: false })).toBe(0);
  });

  it('never compensates while held by a thumb drag or the bottom pin', () => {
    expect(anchorShift({ savedOffset: 0, currentOffset: 500, isHeld: true })).toBe(0);
  });

  it('never compensates before an anchor was recorded', () => {
    expect(anchorShift({ savedOffset: null, currentOffset: 500, isHeld: false })).toBe(0);
  });
});
