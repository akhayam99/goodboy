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
  pageBoxOf,
  COLUMN_FRAME,
  MEASURE_FRAME,
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

describe('page box: the centred column against the drawer', () => {
  const PANES = [1100, 1440, 1920] as const;

  it.each(PANES)('centres the column with equal side space at %i wide, no drawer', (paneWidth) => {
    const box = pageBoxOf({ paneWidth, tier: 'column', drawerWidthPx: null });

    expect(box.width).toBe(Math.min(COLUMN_FRAME, paneWidth));
    expect(box.left).toBe(paneWidth - box.right);
  });

  it('centres the measure tier the same way', () => {
    const box = pageBoxOf({ paneWidth: 1440, tier: 'measure', drawerWidthPx: null });

    expect(box.width).toBe(MEASURE_FRAME);
    expect(box.left).toBe(1440 - box.right);
  });

  it.each(PANES)(
    'keeps the full tier from the left edge at %i wide, drawer or not',
    (paneWidth) => {
      const rest = pageBoxOf({ paneWidth, tier: 'full', drawerWidthPx: null });
      const open = pageBoxOf({ paneWidth, tier: 'full', drawerWidthPx: RIGHT_DRAWER_DEFAULT });

      expect(rest).toEqual({ left: 0, right: paneWidth, width: paneWidth });
      expect(open.left).toBe(0);
      expect(open.right).toBe(layoutOf({ columnWidth: paneWidth, sizing: 'default' }).mainPx);
    },
  );

  it.each(PANES)(
    'slides left clear of a default drawer at %i wide, keeping its width while it fits',
    (paneWidth) => {
      const rest = pageBoxOf({ paneWidth, tier: 'column', drawerWidthPx: null });
      const { drawerWidthPx, mode, mainPx } = layoutOf({
        columnWidth: paneWidth,
        sizing: 'default',
      });
      const open = pageBoxOf({ paneWidth, tier: 'column', drawerWidthPx });
      const drawerLeft = paneWidth - drawerTrackOf(drawerWidthPx);

      if (mode === 'overlay') {
        expect(open).toEqual(rest);
        return;
      }
      expect(open.right).toBeLessThanOrEqual(drawerLeft);
      expect(open.left).toBe(mainPx - open.right);
      expect(open.left).toBeLessThanOrEqual(rest.left);
      expect(open.width).toBe(Math.min(COLUMN_FRAME, mainPx));
      expect(open.width).toBeGreaterThanOrEqual(COLUMN_MIN_PUSH + COLUMN_GUTTERS);
    },
  );

  it.each(PANES)(
    'slides clear of a half artifact drawer at %i wide, or the drawer overlays',
    (paneWidth) => {
      const rest = pageBoxOf({ paneWidth, tier: 'column', drawerWidthPx: null });
      const { drawerWidthPx, mode, mainPx } = layoutOf({ columnWidth: paneWidth, sizing: 'half' });
      const open = pageBoxOf({ paneWidth, tier: 'column', drawerWidthPx, sizing: 'half' });
      const drawerLeft = paneWidth - drawerTrackOf(drawerWidthPx);

      if (mode === 'overlay') {
        expect(open).toEqual(rest);
        return;
      }
      expect(open.right).toBeLessThanOrEqual(drawerLeft);
      expect(open.width).toBe(Math.min(COLUMN_FRAME, mainPx));
    },
  );

  it.each([1440, 1920])(
    'moves left and keeps its width beside the default drawer at %i',
    (paneWidth) => {
      const { drawerWidthPx } = layoutOf({ columnWidth: paneWidth, sizing: 'default' });
      const rest = pageBoxOf({ paneWidth, tier: 'column', drawerWidthPx: null });
      const open = pageBoxOf({ paneWidth, tier: 'column', drawerWidthPx });

      expect(open.left).toBeLessThan(rest.left);
      expect(open.width).toBe(COLUMN_FRAME);
    },
  );

  it('shrinks beside the drawer while it pushes, and keeps the full column once it overlays', () => {
    const pushed = layoutOf({ columnWidth: 1100, sizing: 'default' });
    const overlaid = layoutOf({ columnWidth: 1000, sizing: 'default' });

    expect(pushed.mode).toBe('push');
    expect(
      pageBoxOf({ paneWidth: 1100, tier: 'column', drawerWidthPx: pushed.drawerWidthPx }).width,
    ).toBe(pushed.mainPx);
    expect(overlaid.mode).toBe('overlay');
    expect(
      pageBoxOf({ paneWidth: 1000, tier: 'column', drawerWidthPx: overlaid.drawerWidthPx }).width,
    ).toBe(1000);
  });
});
