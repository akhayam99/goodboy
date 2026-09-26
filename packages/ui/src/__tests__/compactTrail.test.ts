import { describe, expect, it } from 'vitest';
import { compactTrail } from '../components/Trail/compactTrail';

const FULL = 120;
const ICON = 24;
const SEPARATOR = 18;
const ELLIPSIS = 24;
const LEAD = 14;

const run = (depth: number, available: number | null, pinned?: ReadonlyArray<boolean>) =>
  compactTrail({
    fullWidths: Array.from({ length: depth }, () => FULL),
    iconWidths: Array.from({ length: depth }, () => ICON),
    ...(pinned !== undefined && { pinned }),
    separatorWidth: SEPARATOR,
    ellipsisWidth: ELLIPSIS,
    leadWidth: LEAD,
    available,
  });

describe('compactTrail', () => {
  it.each([
    [2, ['full', 'full']],
    [3, ['full', 'full', 'full']],
    [4, ['icon', 'full', 'full', 'full']],
    [5, ['icon', 'icon', 'icon', 'full', 'full']],
    [6, ['icon', 'icon', 'icon', 'icon', 'full', 'full']],
    [7, ['icon', 'icon', 'icon', 'icon', 'icon', 'full', 'full']],
  ])('compacts ancestors by depth alone at depth %i', (depth, expected) => {
    expect(run(depth, 960)).toEqual(expected);
    expect(run(depth, null)).toEqual(expected);
  });

  it.each([480, 720, 960])('always keeps the last crumb and its parent full at %ipx', (width) => {
    for (let depth = 2; depth <= 7; depth += 1) {
      const states = run(depth, width);
      expect(states[depth - 1]).toBe('full');
      expect(states[depth - 2]).toBe('full');
    }
  });

  it('turns ancestors to icons from the left when the width runs out', () => {
    expect(run(3, 330)).toEqual(['icon', 'full', 'full']);
    expect(run(3, 480)).toEqual(['full', 'full', 'full']);
  });

  it('folds icons after the anchor into the ellipsis when icons are not enough', () => {
    const states = run(7, 330);
    expect(states[0]).toBe('icon');
    expect(states.slice(1, 5).every((state) => state === 'folded' || state === 'icon')).toBe(true);
    expect(states).toContain('folded');
    expect(states[5]).toBe('full');
    expect(states[6]).toBe('full');
  });

  it('never folds the anchor', () => {
    expect(run(7, 0)[0]).toBe('icon');
  });

  it('never shrinks a pinned segment', () => {
    expect(run(4, 100, [false, true, false, false])[1]).toBe('full');
  });

  it('keeps every segment full at 960 up to depth 3', () => {
    expect(run(3, 960)).toEqual(['full', 'full', 'full']);
  });
});
