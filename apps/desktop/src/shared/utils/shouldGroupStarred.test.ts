// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { shouldGroupStarred } from './shouldGroupStarred';

describe('shouldGroupStarred', () => {
  it.each([
    { starredCount: 1, total: 6, expected: true },
    { starredCount: 4, total: 39, expected: true },
    { starredCount: 1, total: 5, expected: false },
    { starredCount: 0, total: 12, expected: false },
    { starredCount: 0, total: 0, expected: false },
  ])('starred $starredCount of $total is $expected', ({ starredCount, total, expected }) => {
    expect(shouldGroupStarred({ starredCount, total })).toBe(expected);
  });
});
