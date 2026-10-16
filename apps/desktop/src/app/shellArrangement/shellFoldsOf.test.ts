import { describe, expect, it } from 'vitest';
import { shellFoldsOf } from './shellFoldsOf';

const SIDE_PANE = 416;
const READER_PANE = 736;

describe('shellFoldsOf', () => {
  it('folds nothing before the window width is known', () => {
    expect(
      shellFoldsOf({ windowWidth: null, mainWidth: 240, railWidth: 240, paneWidth: SIDE_PANE }),
    ).toEqual({ isMainNarrow: false, isRailNarrow: false });
  });

  it('keeps both open at 1280 and 1440 with no pane', () => {
    for (const windowWidth of [1280, 1440]) {
      expect(shellFoldsOf({ windowWidth, mainWidth: 240, railWidth: 240, paneWidth: 0 })).toEqual({
        isMainNarrow: false,
        isRailNarrow: false,
      });
    }
  });

  it('folds the main sidebar first when a pane opens at 1440', () => {
    expect(
      shellFoldsOf({ windowWidth: 1440, mainWidth: 240, railWidth: 240, paneWidth: SIDE_PANE }),
    ).toEqual({ isMainNarrow: true, isRailNarrow: false });
  });

  it('folds the session rail too when a pane opens at 1280', () => {
    expect(
      shellFoldsOf({ windowWidth: 1280, mainWidth: 240, railWidth: 240, paneWidth: SIDE_PANE }),
    ).toEqual({ isMainNarrow: true, isRailNarrow: true });
  });

  it('folds both beside the reader pane at 1440', () => {
    expect(
      shellFoldsOf({ windowWidth: 1440, mainWidth: 240, railWidth: 240, paneWidth: READER_PANE }),
    ).toEqual({ isMainNarrow: true, isRailNarrow: true });
  });

  it('counts a wider saved main sidebar', () => {
    expect(
      shellFoldsOf({ windowWidth: 1280, mainWidth: 400, railWidth: 240, paneWidth: 0 }),
    ).toEqual({ isMainNarrow: true, isRailNarrow: false });
  });
});
