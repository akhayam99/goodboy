import { describe, expect, it } from 'vitest';
import {
  LEFT_SIDEBAR_DEFAULT,
  LEFT_SIDEBAR_MAX,
  LEFT_SIDEBAR_MIN,
  RIGHT_DRAWER_DEFAULT,
  drawerModeOf,
  mainWidthOf,
} from '@goodboy/ui';
import { branchLayoutOf } from './branchLayout';

const paneWidthOf = ({
  windowPx,
  zoom = 1,
  sidebarPx,
  isDrawerOpen,
}: {
  readonly windowPx: number;
  readonly zoom?: number;
  readonly sidebarPx: number;
  readonly isDrawerOpen: boolean;
}): number => {
  const columnWidth = Math.round(windowPx / zoom) - sidebarPx;
  const mode = drawerModeOf({
    isOpen: isDrawerOpen,
    sizing: 'default',
    columnWidth,
    drawerWidthPx: RIGHT_DRAWER_DEFAULT,
  });
  return mainWidthOf({ columnWidth, mode, drawerWidthPx: RIGHT_DRAWER_DEFAULT });
};

describe('branchLayoutOf', () => {
  it('goes from one column to two to three as the pane widens', () => {
    expect(branchLayoutOf({ widthPx: 899 })).toBe('single');
    expect(branchLayoutOf({ widthPx: 900 })).toBe('two');
    expect(branchLayoutOf({ widthPx: 1279 })).toBe('two');
    expect(branchLayoutOf({ widthPx: 1280 })).toBe('three');
  });

  it('reads two columns before the pane has been measured', () => {
    expect(branchLayoutOf({ widthPx: null })).toBe('two');
  });

  it('shows one column at 1024px with a wide sidebar and an open drawer, which lies over it', () => {
    const widthPx = paneWidthOf({
      windowPx: 1024,
      sidebarPx: LEFT_SIDEBAR_MAX,
      isDrawerOpen: true,
    });
    expect(widthPx).toBe(1024 - LEFT_SIDEBAR_MAX);
    expect(branchLayoutOf({ widthPx })).toBe('single');
  });

  it('never gives a 1024px window more than one column, drawer or not, at any zoom', () => {
    for (const zoom of [1, 1.25]) {
      for (const sidebarPx of [LEFT_SIDEBAR_MIN, LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX]) {
        for (const isDrawerOpen of [false, true]) {
          const widthPx = paneWidthOf({ windowPx: 1024, zoom, sidebarPx, isDrawerOpen });
          expect(branchLayoutOf({ widthPx })).toBe('single');
        }
      }
    }
  });

  it('keeps the thread wide at 1440, with its properties inline under it', () => {
    const widthPx = paneWidthOf({
      windowPx: 1440,
      sidebarPx: LEFT_SIDEBAR_DEFAULT,
      isDrawerOpen: false,
    });
    expect(branchLayoutOf({ widthPx })).toBe('two');
  });

  it('adds the properties rail at 1920, and at 1440 zoomed out to 0.8', () => {
    for (const [windowPx, zoom] of [
      [1920, 1],
      [1440, 0.8],
    ] as const) {
      const widthPx = paneWidthOf({
        windowPx,
        zoom,
        sidebarPx: LEFT_SIDEBAR_DEFAULT,
        isDrawerOpen: false,
      });
      expect(branchLayoutOf({ widthPx })).toBe('three');
    }
  });

  it('keeps the list beside the thread at 1600px with a drawer, one column at the widest column', () => {
    const atDefault = paneWidthOf({
      windowPx: 1600,
      sidebarPx: LEFT_SIDEBAR_DEFAULT,
      isDrawerOpen: true,
    });
    const atMax = paneWidthOf({ windowPx: 1600, sidebarPx: LEFT_SIDEBAR_MAX, isDrawerOpen: true });
    expect(branchLayoutOf({ widthPx: atDefault })).toBe('two');
    expect(branchLayoutOf({ widthPx: atMax })).toBe('single');
  });

  it('gives the rail back when a pushed drawer opens beside a 1920px window', () => {
    const widthPx = paneWidthOf({
      windowPx: 1920,
      sidebarPx: LEFT_SIDEBAR_DEFAULT,
      isDrawerOpen: true,
    });
    expect(branchLayoutOf({ widthPx })).toBe('two');
  });
});
