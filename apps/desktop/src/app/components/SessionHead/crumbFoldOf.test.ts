import { describe, expect, it } from 'vitest';
import { crumbFoldOf } from './crumbFoldOf';

describe('crumbFoldOf', () => {
  it.each([1, 2, 3, 4])('shows every crumb of a %i crumb trail', (count) => {
    const fold = crumbFoldOf({ count });

    expect(fold.folded).toEqual([]);
    expect(fold.shown).toHaveLength(count);
  });

  it('keeps the first and the last two of five crumbs and folds the middle', () => {
    expect(crumbFoldOf({ count: 5 })).toEqual({ shown: [0, 3, 4], folded: [1, 2] });
  });

  it('folds every middle crumb of a deep trail into one place', () => {
    expect(crumbFoldOf({ count: 8 })).toEqual({ shown: [0, 6, 7], folded: [1, 2, 3, 4, 5] });
  });
});
