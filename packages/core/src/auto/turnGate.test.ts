import { describe, expect, it } from 'vitest';
import { AUTO_BLOCK_TEXT, turnGate } from './turnGate';

describe('turnGate', () => {
  it('names a stall without claiming the replies had no text, since a text reply that leaves a return undecided counts too', () => {
    expect(turnGate({ noProgressStreak: 3, remainingUsd: 10 })).toBe('limit_no_progress');
    expect(AUTO_BLOCK_TEXT.limit_no_progress).toBe('The Lead replied 3 times with no next step.');
  });

  it('lets a turn through below the streak with money left', () => {
    expect(turnGate({ noProgressStreak: 2, remainingUsd: 10 })).toBeNull();
  });
});
