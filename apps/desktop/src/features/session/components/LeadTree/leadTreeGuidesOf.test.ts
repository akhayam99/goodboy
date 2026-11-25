import { describe, expect, it } from 'vitest';
import { leadTreeGuidesOf } from './leadTreeGuidesOf';

describe('leadTreeGuidesOf', () => {
  it('marks the last child of a branch and carries a trunk past an ancestor with a later sibling', () => {
    const guides = leadTreeGuidesOf({ levels: [0, 1, 2, 2, 1, 1] });
    expect(guides.map((guide) => guide.hasNext)).toEqual([false, true, true, false, true, false]);
    expect(guides.map((guide) => guide.hasChildren)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(guides[2]?.trunks).toEqual([true]);
    expect(guides[3]?.trunks).toEqual([true]);
  });

  it('draws no trunk under an ancestor that closes the branch', () => {
    const guides = leadTreeGuidesOf({ levels: [0, 1, 2, 3] });
    expect(guides[3]?.trunks).toEqual([false, false]);
  });
});
