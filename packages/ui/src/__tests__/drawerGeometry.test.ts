import { describe, expect, it } from 'vitest';
import { LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX } from '../components/AppShell';
import {
  COLUMN_GUTTERS,
  COLUMN_MIN_PUSH,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MIN,
  drawerModeOf,
  drawerTrackOf,
  drawerWidthOf,
  mainWidthOf,
  type DrawerSizing,
} from '../drawerGeometry';

const WINDOWS = [1024, 1440, 1920] as const;
const ZOOMS = [0.8, 1, 1.25] as const;
const SIDEBARS = [LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX] as const;
const SIZINGS: ReadonlyArray<DrawerSizing> = ['default', 'half', 'full'];

const paneOf = ({
  windowPx,
  zoom,
  sidebarPx,
}: {
  readonly windowPx: number;
  readonly zoom: number;
  readonly sidebarPx: number;
}): number => Math.round(windowPx / zoom) - sidebarPx;

const layoutOf = ({
  columnWidth,
  sizing,
}: {
  readonly columnWidth: number;
  readonly sizing: DrawerSizing;
}) => {
  const drawerWidthPx = drawerWidthOf({
    sizing,
    columnWidth,
    resizableWidth: RIGHT_DRAWER_DEFAULT,
  });
  const mode = drawerModeOf({ isOpen: true, sizing, columnWidth, drawerWidthPx });
  return { drawerWidthPx, mode, mainPx: mainWidthOf({ columnWidth, mode, drawerWidthPx }) };
};

const MATRIX = WINDOWS.flatMap((windowPx) =>
  ZOOMS.flatMap((zoom) =>
    SIDEBARS.flatMap((sidebarPx) =>
      SIZINGS.map((sizing) => ({
        windowPx,
        zoom,
        sidebarPx,
        sizing,
        columnWidth: paneOf({ windowPx, zoom, sidebarPx }),
      })),
    ),
  ),
);

describe('drawer geometry across the width matrix', () => {
  it.each(MATRIX)(
    '$windowPx px at zoom $zoom, sidebar $sidebarPx, $sizing drawer: pushes only beside a 560px main, else overlays',
    ({ columnWidth, sizing }) => {
      const { drawerWidthPx, mode, mainPx } = layoutOf({ columnWidth, sizing });

      expect(drawerWidthPx).toBeGreaterThanOrEqual(RIGHT_DRAWER_MIN);
      if (mode === 'push') {
        expect(mainPx).toBeGreaterThanOrEqual(COLUMN_MIN_PUSH + COLUMN_GUTTERS);
        expect(mainPx + drawerTrackOf(drawerWidthPx)).toBe(columnWidth);
        return;
      }
      expect(mode).toBe('overlay');
      expect(mainPx).toBe(columnWidth);
    },
  );

  it('never moves the main content: the main area keeps its start, only its right edge changes', () => {
    const offenders = MATRIX.filter(({ columnWidth, sizing }) => {
      const { mainPx } = layoutOf({ columnWidth, sizing });
      return mainPx > columnWidth || mainPx <= 0;
    });

    expect(offenders).toEqual([]);
  });

  it('opens the half drawer beside the work at 1440 and over it at 1024', () => {
    const at1440 = layoutOf({
      columnWidth: paneOf({ windowPx: 1440, zoom: 1, sidebarPx: LEFT_SIDEBAR_DEFAULT }),
      sizing: 'half',
    });
    const at1024 = layoutOf({
      columnWidth: paneOf({ windowPx: 1024, zoom: 1.25, sidebarPx: LEFT_SIDEBAR_DEFAULT }),
      sizing: 'half',
    });

    expect(at1440.mode).toBe('push');
    expect(at1024.mode).toBe('overlay');
  });

  it('covers the work when the drawer is expanded, at every width', () => {
    const modes = MATRIX.filter(({ sizing }) => sizing === 'full').map(
      ({ columnWidth }) => layoutOf({ columnWidth, sizing: 'full' }).mode,
    );

    expect(new Set(modes)).toEqual(new Set(['overlay']));
  });

  it('keeps a closed drawer closed whatever the width', () => {
    expect(
      drawerModeOf({ isOpen: false, sizing: 'half', columnWidth: 1600, drawerWidthPx: 400 }),
    ).toBe('closed');
  });
});
