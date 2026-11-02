// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LEFT_SIDEBAR_DEFAULT } from '@goodboy/ui';
import { SPLIT_MIN_INNER_PX, effectiveDiffLayout } from './effectiveDiffLayout';

const TREE_AND_GUTTERS_PX = 321;
const GUTTERS_PX = 40;

type InnerParams = {
  readonly windowPx: number;
  readonly zoom: number;
  readonly fixedPx: number;
};

const innerOf = ({ windowPx, zoom, fixedPx }: InnerParams) =>
  Math.round(windowPx / zoom) - LEFT_SIDEBAR_DEFAULT - fixedPx;

describe('effectiveDiffLayout', () => {
  it('keeps unified as chosen at any width and says whether split is open', () => {
    expect(effectiveDiffLayout({ preference: 'unified', innerWidthPx: 2000 })).toEqual({
      layout: 'unified',
      isSplitAvailable: true,
    });
    expect(effectiveDiffLayout({ preference: 'unified', innerWidthPx: 400 })).toEqual({
      layout: 'unified',
      isSplitAvailable: false,
    });
  });

  it('splits from 880px of inner width and falls back to unified under it', () => {
    expect(effectiveDiffLayout({ preference: 'split', innerWidthPx: SPLIT_MIN_INNER_PX })).toEqual({
      layout: 'split',
      isSplitAvailable: true,
    });
    expect(
      effectiveDiffLayout({ preference: 'split', innerWidthPx: SPLIT_MIN_INNER_PX - 1 }),
    ).toEqual({ layout: 'unified', isSplitAvailable: false });
  });

  it('trusts the choice until the width is measured', () => {
    expect(effectiveDiffLayout({ preference: 'split', innerWidthPx: null }).layout).toBe('split');
  });

  it.each([
    [1024, 1, 'unified'],
    [1440, 1.25, 'unified'],
    [1440, 1, 'unified'],
    [1440, 0.8, 'split'],
    [1920, 1, 'split'],
  ] as const)(
    'a split choice at %i px and zoom %s with a docked tree reads %s',
    (windowPx, zoom, expected) => {
      const result = effectiveDiffLayout({
        preference: 'split',
        innerWidthPx: innerOf({ windowPx, zoom, fixedPx: TREE_AND_GUTTERS_PX }),
      });

      expect(result.layout).toBe(expected);
      expect(result.isSplitAvailable).toBe(expected === 'split');
    },
  );

  it.each([
    [1280, 1, 'split'],
    [1440, 1, 'split'],
    [1440, 1.25, 'unified'],
    [1920, 1, 'split'],
  ] as const)(
    'a split choice at %i px and zoom %s with the tree folded reads %s',
    (windowPx, zoom, expected) => {
      const result = effectiveDiffLayout({
        preference: 'split',
        innerWidthPx: innerOf({ windowPx, zoom, fixedPx: GUTTERS_PX }),
      });

      expect(result.layout).toBe(expected);
    },
  );
});
