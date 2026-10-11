// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { shouldGroupStarred } from './shouldGroupStarred';

describe('shouldGroupStarred', () => {
  it.each([
    { starredCount: 1, total: 6, isGrouped: true },
    { starredCount: 4, total: 39, isGrouped: true },
    { starredCount: 1, total: 5, isGrouped: false },
    { starredCount: 0, total: 12, isGrouped: false },
    { starredCount: 0, total: 0, isGrouped: false },
  ])('starred $starredCount of $total is $isGrouped', ({ starredCount, total, isGrouped }) => {
    expect(shouldGroupStarred({ starredCount, total })).toBe(isGrouped);
  });
});
