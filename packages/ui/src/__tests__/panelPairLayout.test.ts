import { describe, expect, it } from 'vitest';
import {
  COLUMN_GUTTERS,
  COLUMN_MIN_PUSH,
  DRAWER_INSET,
  READER_DRAWER_DEFAULT,
  RIGHT_DRAWER_DEFAULT,
  drawerAsideWidthOf,
  drawerLayoutOf,
  mainWidthOf,
  panelAsideWidthOf,
  panelPairLayoutOf,
  type DrawerPanelSpec,
} from '../drawerGeometry';

const RAIL = 44;

const TERMINAL: DrawerPanelSpec = {
  sizing: 'side',
  savedWidth: RIGHT_DRAWER_DEFAULT,
  isOpen: true,
};
const BROWSER: DrawerPanelSpec = {
  sizing: 'browser',
  savedWidth: READER_DRAWER_DEFAULT,
  isOpen: true,
};
const ARTIFACT: DrawerPanelSpec = {
  sizing: 'side',
  savedWidth: RIGHT_DRAWER_DEFAULT,
  isOpen: true,
};
const CLOSED: DrawerPanelSpec = { ...ARTIFACT, isOpen: false };

type PairParams = {
  readonly main: number;
  readonly dock: DrawerPanelSpec;
  readonly detail: DrawerPanelSpec;
};

const pairAt = ({ main, dock, detail }: PairParams) =>
  panelPairLayoutOf({ main, dock, detail, edgeWidth: RAIL, contentInset: RAIL });

describe('the page frame with a detail panel and a tool dock', () => {
  it('lays a lone dock out exactly as the one drawer rule does', () => {
    const pair = pairAt({ main: 1200, dock: TERMINAL, detail: CLOSED });
    const alone = drawerLayoutOf({
      main: 1200,
      sizing: 'side',
      savedWidth: RIGHT_DRAWER_DEFAULT,
      edgeWidth: RAIL,
      contentInset: RAIL,
    });

    expect(pair.mode).toBe(alone.mode);
    expect(pair.dock).toMatchObject({ width: alone.width, dragMax: alone.dragMax });
  });

  it('lays a lone detail panel out by its own tier', () => {
    const pair = pairAt({ main: 1200, dock: { ...TERMINAL, isOpen: false }, detail: ARTIFACT });

    expect(pair.mode).toBe('push');
    expect(pair.detail.width).toBe(RIGHT_DRAWER_DEFAULT);
  });

  it('pushes both at their saved widths when the page keeps its column beside them', () => {
    const main = 1600;
    const pair = pairAt({ main, dock: TERMINAL, detail: ARTIFACT });
    const aside = panelAsideWidthOf({
      dockWidth: pair.dock.width,
      detailWidth: pair.detail.width,
      railWidth: RAIL,
    });

    expect(pair.mode).toBe('push');
    expect(aside).toBe(RIGHT_DRAWER_DEFAULT * 2 + DRAWER_INSET * 2 + RAIL);
    expect(main - aside).toBeGreaterThanOrEqual(COLUMN_MIN_PUSH + COLUMN_GUTTERS);
  });

  it('lays both over the page from the right edge when they do not fit beside it, rail kept', () => {
    const main = 1100 - 246;
    const pair = pairAt({ main, dock: BROWSER, detail: ARTIFACT });

    expect(pair.mode).toBe('overlay');
    expect(
      panelAsideWidthOf({
        dockWidth: pair.dock.width,
        detailWidth: pair.detail.width,
        railWidth: RAIL,
      }),
    ).toBeLessThanOrEqual(main - DRAWER_INSET);
  });

  it('shrinks a browser dock into the room the detail panel leaves, never below its fallback', () => {
    const pair = pairAt({ main: 2400, dock: { ...BROWSER, savedWidth: 4000 }, detail: ARTIFACT });

    expect(pair.mode).toBe('push');
    expect(pair.dock.width).toBe(pair.dock.dragMax);
    expect(pair.dock.width).toBeGreaterThanOrEqual(READER_DRAWER_DEFAULT);
  });

  it('counts the main width from the aside it stands beside, rail included', () => {
    expect(
      mainWidthOf({ columnWidth: 1200, mode: 'push', drawerWidthPx: 400, railWidth: RAIL }),
    ).toBe(1200 - drawerAsideWidthOf({ width: 400, mode: 'push', railWidth: RAIL }));
    expect(
      mainWidthOf({ columnWidth: 1200, mode: 'overlay', drawerWidthPx: 400, railWidth: RAIL }),
    ).toBe(1200 - RAIL - DRAWER_INSET);
    expect(mainWidthOf({ columnWidth: 1200, mode: 'closed', drawerWidthPx: 400 })).toBe(1200);
  });
});
