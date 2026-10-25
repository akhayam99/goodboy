import { describe, expect, it } from 'vitest';
import { repliesLabel } from './repliesLabel';

describe('repliesLabel', () => {
  it('counts one reply in the singular', () => {
    expect(repliesLabel({ count: 1 })).toBe('1 reply');
  });

  it('counts the rest in the plural', () => {
    expect(repliesLabel({ count: 0 })).toBe('0 replies');
    expect(repliesLabel({ count: 4 })).toBe('4 replies');
  });
});
