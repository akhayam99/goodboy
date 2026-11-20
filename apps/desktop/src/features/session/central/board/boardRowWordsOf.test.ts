// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { elapsedWordOf } from './boardRowWordsOf';

describe('elapsedWordOf', () => {
  it('writes agent time the way every other duration in the app reads', () => {
    expect(elapsedWordOf({ elapsedMs: 0 })).toBe('0s');
    expect(elapsedWordOf({ elapsedMs: 45_000 })).toBe('45s');
    expect(elapsedWordOf({ elapsedMs: 12 * 60_000 })).toBe('12m');
    expect(elapsedWordOf({ elapsedMs: 90 * 60_000 })).toBe('1h 30m');
  });
});
