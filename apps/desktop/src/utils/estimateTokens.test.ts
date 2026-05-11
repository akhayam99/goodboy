import { describe, expect, it } from 'vitest';
import { estimateTokens } from './estimateTokens';

describe('estimateTokens', () => {
  it('empty string → 0', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('short text rounds up', () => {
    expect(estimateTokens('a')).toBe(1);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('long text scales by chars/4', () => {
    const text = 'x'.repeat(4000);
    expect(estimateTokens(text)).toBe(1000);
  });
});
