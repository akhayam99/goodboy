import { describe, expect, it } from 'vitest';
import { msUntilMidnight } from './msUntilMidnight';

describe('msUntilMidnight', () => {
  it('counts the milliseconds to the next local midnight', () => {
    const now = new Date(2026, 10, 20, 23, 59, 0).getTime();
    expect(msUntilMidnight({ now })).toBe(60_050);
  });

  it('counts a full day from midnight itself', () => {
    const now = new Date(2026, 10, 21, 0, 0, 0).getTime();
    expect(msUntilMidnight({ now })).toBe(86_400_050);
  });
});
