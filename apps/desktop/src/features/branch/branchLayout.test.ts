import { describe, expect, it } from 'vitest';
import {
  DRAWER_INSET,
  LEFT_SIDEBAR_DEFAULT,
  LEFT_SIDEBAR_MAX,
  LEFT_SIDEBAR_MIN,
  RIGHT_DRAWER_DEFAULT,
  canDrawerPush,
} from '@goodboy/ui';
import { branchLayoutOf } from './branchLayout';

const paneWidthOf = ({
  windowPx,
  sidebarPx,
  isDrawerOpen,
}: {
  readonly windowPx: number;
  readonly sidebarPx: number;
  readonly isDrawerOpen: boolean;
}): number => {
  const main = windowPx - sidebarPx;
  if (!isDrawerOpen || !canDrawerPush({ mainWidthPx: main, drawerWidthPx: RIGHT_DRAWER_DEFAULT })) {
    return main;
  }
  return main - RIGHT_DRAWER_DEFAULT - DRAWER_INSET * 2;
};

describe('branchLayoutOf', () => {
  it('goes from one column to two to three as the pane widens', () => {
    expect(branchLayoutOf({ widthPx: 899 })).toBe('single');
    expect(branchLayoutOf({ widthPx: 900 })).toBe('two');
    expect(branchLayoutOf({ widthPx: 1039 })).toBe('two');
    expect(branchLayoutOf({ widthPx: 1040 })).toBe('three');
  });

  it('reads two columns before the pane has been measured', () => {
    expect(branchLayoutOf({ widthPx: null })).toBe('two');
  });

  it('shows one column at 1024px with a wide sidebar and an open drawer', () => {
    const widthPx = paneWidthOf({
      windowPx: 1024,
      sidebarPx: LEFT_SIDEBAR_MAX,
      isDrawerOpen: true,
    });
    expect(widthPx).toBe(624);
    expect(branchLayoutOf({ widthPx })).toBe('single');
  });

  it('never gives a 1024px window more than one column, drawer or not', () => {
    for (const sidebarPx of [LEFT_SIDEBAR_MIN, LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX]) {
      for (const isDrawerOpen of [false, true]) {
        const widthPx = paneWidthOf({ windowPx: 1024, sidebarPx, isDrawerOpen });
        expect(branchLayoutOf({ widthPx })).toBe('single');
      }
    }
  });

  it('keeps three columns on a 1600px window with the default sidebar and no drawer', () => {
    const widthPx = paneWidthOf({
      windowPx: 1600,
      sidebarPx: LEFT_SIDEBAR_DEFAULT,
      isDrawerOpen: false,
    });
    expect(branchLayoutOf({ widthPx })).toBe('three');
  });

  it('keeps the list beside the thread when a pushed drawer opens beside a 1600px window', () => {
    const widthPx = paneWidthOf({
      windowPx: 1600,
      sidebarPx: LEFT_SIDEBAR_DEFAULT,
      isDrawerOpen: true,
    });
    expect(widthPx).toBe(944);
    expect(branchLayoutOf({ widthPx })).toBe('two');
  });

  it('falls back to one column when a pushed drawer opens beside the widest column at 1600px', () => {
    const widthPx = paneWidthOf({
      windowPx: 1600,
      sidebarPx: LEFT_SIDEBAR_MAX,
      isDrawerOpen: true,
    });
    expect(widthPx).toBe(784);
    expect(branchLayoutOf({ widthPx })).toBe('single');
  });
});
