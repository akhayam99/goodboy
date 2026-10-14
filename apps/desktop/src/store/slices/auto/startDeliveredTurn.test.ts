import { describe, expect, it } from 'vitest';
import { pollCountOf, pollIntervalOf } from './startDeliveredTurn';

describe('how often the registry is asked whether a turn started', () => {
  it('asks quickly at first, so a normal start is seen at once', () => {
    expect(pollIntervalOf({ poll: 0 })).toBe(50);
    expect(pollIntervalOf({ poll: 39 })).toBe(50);
  });

  it('slows down after two seconds, so a long wait for the writer is cheap', () => {
    expect(pollIntervalOf({ poll: 40 })).toBe(500);
    expect(pollIntervalOf({ poll: 900 })).toBe(500);
  });

  it('keeps the number of asks small over a long wait and exact over a short one', () => {
    expect(pollCountOf({ acceptTimeoutMs: 1_000 })).toBe(20);
    expect(pollCountOf({ acceptTimeoutMs: 2_000 })).toBe(40);
    expect(pollCountOf({ acceptTimeoutMs: 20_000 })).toBe(76);
    expect(pollCountOf({ acceptTimeoutMs: 31 * 60_000 })).toBeLessThan(4_000);
  });
});
