// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LEFT_SIDEBAR_DEFAULT } from '@goodboy/ui';
import { effectiveDiffLayout } from './effectiveDiffLayout';

const SPLIT_MIN_INNER_PX = 880;

const TREE_AND_GUTTERS_PX = 321;

const innerOf = ({ windowPx, zoom }: { readonly windowPx: number; readonly zoom: number }) =>
  Math.round(windowPx / zoom) - LEFT_SIDEBAR_DEFAULT - TREE_AND_GUTTERS_PX;

describe('effectiveDiffLayout', () => {
  it('keeps unified as chosen at any width', () => {
    expect(effectiveDiffLayout({ preference: 'unified', innerWidthPx: 2000 })).toEqual({
      layout: 'unified',
      isSplitTooNarrow: false,
    });
  });

  it('splits from 880px of inner width and falls back to unified under it, saying why', () => {
    expect(effectiveDiffLayout({ preference: 'split', innerWidthPx: SPLIT_MIN_INNER_PX })).toEqual({
      layout: 'split',
      isSplitTooNarrow: false,
    });
    expect(
      effectiveDiffLayout({ preference: 'split', innerWidthPx: SPLIT_MIN_INNER_PX - 1 }),
    ).toEqual({ layout: 'unified', isSplitTooNarrow: true });
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
  ] as const)('a split choice at %i px and zoom %s reads %s', (windowPx, zoom, expected) => {
    const result = effectiveDiffLayout({
      preference: 'split',
      innerWidthPx: innerOf({ windowPx, zoom }),
    });

    expect(result.layout).toBe(expected);
    expect(result.isSplitTooNarrow).toBe(expected === 'unified');
  });
});
