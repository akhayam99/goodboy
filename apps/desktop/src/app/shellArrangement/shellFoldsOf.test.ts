import { drawerLayoutOf, mainWidthOf } from '@goodboy/ui';
import { describe, expect, it } from 'vitest';
import { shellFoldsOf } from './shellFoldsOf';

describe('shellFoldsOf', () => {
  it('folds nothing with no pane open', () => {
    expect(shellFoldsOf({ paneSizing: null })).toEqual({ isRailNarrow: false });
  });

  it('folds nothing for a side tier pane', () => {
    expect(shellFoldsOf({ paneSizing: 'side' })).toEqual({ isRailNarrow: false });
  });

  it('folds the session rail to its icons for a reader tier pane, never the main sidebar', () => {
    expect(shellFoldsOf({ paneSizing: 'reader' })).toEqual({ isRailNarrow: true });
    expect(shellFoldsOf({ paneSizing: 'browser' })).toEqual({ isRailNarrow: true });
  });
});

const WIDTHS = [1100, 1280, 1350, 1460, 1550];

it.each(WIDTHS)('folds only when the content beside a side drawer needs it at %ipx', (width) => {
  expect(shellFoldsOf({ paneSizing: 'side', columnWidth: width - 246 }).isRailNarrow).toBe(
    width < 1458,
  );
});

it.each([
  [1100, true, 'overlay', 766],
  [1280, true, 'push', 530],
  [1350, true, 'push', 600],
  [1460, false, 'push', 514],
  [1550, false, 'push', 604],
] as const)(
  'keeps fold and drawer geometry in agreement at %ipx',
  (width, isFolded, mode, contentWidth) => {
    const main = width - 246;
    const contentInset = (isFolded ? 44 : 240) + 44;
    expect(shellFoldsOf({ paneSizing: 'side', columnWidth: main }).isRailNarrow).toBe(isFolded);
    const layout = drawerLayoutOf({ main, sizing: 'side', savedWidth: 400, contentInset });
    expect(layout.mode).toBe(mode);
    expect(
      mainWidthOf({ columnWidth: main, mode: layout.mode, drawerWidthPx: layout.width }) -
        contentInset,
    ).toBe(contentWidth);
  },
);

it('folds for a wider saved side drawer using the same push threshold', () => {
  expect(
    shellFoldsOf({ paneSizing: 'side', columnWidth: 1214, drawerWidth: 560 }).isRailNarrow,
  ).toBe(true);
});
