import { describe, expect, it } from 'vitest';
import { LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX } from '../components/AppShell';
import {
  COLUMN_FRAME,
  COLUMN_GUTTERS,
  COLUMN_MIN_PUSH,
  DRAWER_INSET,
  MEASURE_FRAME,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MAX,
  RIGHT_DRAWER_MIN,
  canDrawerPush,
  drawerAsideWidthOf,
  drawerLayoutOf,
  drawerModeOf,
  drawerTrackOf,
  drawerWidthOf,
  mainWidthOf,
  pageBoxOf,
  type DrawerSizing,
} from '../drawerGeometry';

const WINDOWS = [1024, 1440, 1920] as const;
const ZOOMS = [0.8, 1, 1.25] as const;
const SIDEBARS = [LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX] as const;
const SIZINGS: ReadonlyArray<DrawerSizing> = ['default', 'half', 'full'];
const SIDE_AND_WIDE: ReadonlyArray<DrawerSizing> = ['default', 'half'];

const paneOf = ({
  windowPx,
  zoom,
  sidebarPx,
}: {
  readonly windowPx: number;
  readonly zoom: number;
  readonly sidebarPx: number;
}): number => Math.round(windowPx / zoom) - sidebarPx;

const roomOf = (main: number): number => main - 16 - 48 - 560;

const layoutOf = ({
  columnWidth,
  sizing,
  savedWidth = RIGHT_DRAWER_DEFAULT,
}: {
  readonly columnWidth: number;
  readonly sizing: DrawerSizing;
  readonly savedWidth?: number;
}) => {
  const layout = drawerLayoutOf({ main: columnWidth, sizing, savedWidth });
  return {
    drawerWidthPx: layout.width,
    mode: layout.mode,
    mainPx: mainWidthOf({ columnWidth, mode: layout.mode, drawerWidthPx: layout.width }),
  };
};

const MAINS = Array.from({ length: 1801 }, (_, index) => 600 + index);

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

describe('the constants of the drawer scale', () => {
  it('runs a side drawer from 384 to 560 and opens it at 400', () => {
    expect([RIGHT_DRAWER_MIN, RIGHT_DRAWER_DEFAULT, RIGHT_DRAWER_MAX]).toEqual([384, 400, 560]);
  });
});

describe.each(SIDE_AND_WIDE)('one push rule for the %s drawer', (sizing) => {
  const targetOf = (savedWidth: number): number =>
    sizing === 'half' ? RIGHT_DRAWER_MAX : savedWidth;

  it.each([RIGHT_DRAWER_MIN, RIGHT_DRAWER_DEFAULT, 480, RIGHT_DRAWER_MAX])(
    'pushes exactly when the page keeps 560px beside a %i saved width, at every main from 600 to 2400',
    (savedWidth) => {
      const offenders = MAINS.filter((main) => {
        const layout = drawerLayoutOf({ main, sizing, savedWidth });
        const room = roomOf(main);
        const expected =
          room >= RIGHT_DRAWER_MIN
            ? { mode: 'push', width: Math.min(targetOf(savedWidth), room) }
            : { mode: 'overlay', width: Math.min(targetOf(savedWidth), main - 16) };
        return layout.mode !== expected.mode || layout.width !== expected.width;
      });

      expect(offenders).toEqual([]);
    },
  );

  it('never returns to overlay once it pushes, as main grows', () => {
    const modes = MAINS.map((main) => drawerLayoutOf({ main, sizing, savedWidth: 400 }).mode);
    const firstPush = modes.indexOf('push');

    expect(firstPush).toBeGreaterThan(0);
    expect(modes.slice(0, firstPush).every((mode) => mode === 'overlay')).toBe(true);
    expect(modes.slice(firstPush).every((mode) => mode === 'push')).toBe(true);
    expect(MAINS[firstPush]).toBe(624 + RIGHT_DRAWER_MIN);
  });

  it('never narrows as main grows, within overlay and within push', () => {
    const layouts = MAINS.map((main) => drawerLayoutOf({ main, sizing, savedWidth: 400 }));
    const narrowed = layouts.filter(
      (layout, index) =>
        index > 0 &&
        layouts[index - 1]?.mode === layout.mode &&
        layout.width < (layouts[index - 1]?.width ?? 0),
    );

    expect(narrowed).toEqual([]);
  });

  it('takes its drag ceiling from the room while it pushes, and the scale max over the page', () => {
    const offenders = MAINS.filter((main) => {
      const layout = drawerLayoutOf({ main, sizing, savedWidth: 400 });
      const room = roomOf(main);
      return layout.mode === 'push'
        ? layout.dragMax !== Math.min(RIGHT_DRAWER_MAX, room)
        : layout.dragMax !== RIGHT_DRAWER_MAX;
    });

    expect(offenders).toEqual([]);
  });

  it('keeps every drag inside the ceiling in the mode it started in', () => {
    const offenders = MAINS.flatMap((main) => {
      const rest = drawerLayoutOf({ main, sizing, savedWidth: RIGHT_DRAWER_DEFAULT });
      return Array.from(
        { length: rest.dragMax - RIGHT_DRAWER_MIN + 1 },
        (_, step) => RIGHT_DRAWER_MIN + step,
      )
        .map((savedWidth) => ({
          main,
          savedWidth,
          layout: drawerLayoutOf({ main, sizing, savedWidth }),
        }))
        .filter(
          ({ layout }) =>
            layout.mode !== rest.mode ||
            (layout.mode === 'push' && layout.width > rest.dragMax) ||
            layout.width < RIGHT_DRAWER_MIN,
        );
    });

    expect(offenders).toEqual([]);
  });
});

describe('the named widths of the plan', () => {
  it('lies a side drawer over a 1000px main and pushes it at 1200', () => {
    expect(drawerLayoutOf({ main: 1000, sizing: 'default', savedWidth: 400 })).toEqual({
      mode: 'overlay',
      width: 400,
      dragMax: RIGHT_DRAWER_MAX,
    });
    expect(drawerLayoutOf({ main: 1200, sizing: 'default', savedWidth: 400 })).toEqual({
      mode: 'push',
      width: 400,
      dragMax: 560,
    });
  });

  it('pushes a wide drawer at 560, or at the room when that is smaller', () => {
    expect(drawerLayoutOf({ main: 1440, sizing: 'half', savedWidth: 400 })).toMatchObject({
      mode: 'push',
      width: 560,
    });
    expect(drawerLayoutOf({ main: 1100, sizing: 'half', savedWidth: 400 })).toMatchObject({
      mode: 'push',
      width: 476,
    });
    expect(drawerLayoutOf({ main: 1008, sizing: 'half', savedWidth: 400 })).toMatchObject({
      mode: 'push',
      width: RIGHT_DRAWER_MIN,
    });
  });

  it('keeps a wide drawer over the page at 560 until the narrowest drawer fits beside it', () => {
    expect(drawerLayoutOf({ main: 1007, sizing: 'half', savedWidth: 400 })).toMatchObject({
      mode: 'overlay',
      width: 560,
    });
    expect(drawerLayoutOf({ main: 600, sizing: 'half', savedWidth: 400 })).toMatchObject({
      mode: 'overlay',
      width: 560,
    });
  });

  it('keeps a saved 560 pushing at the room, and the saved width itself untouched', () => {
    const layout = drawerLayoutOf({ main: 1100, sizing: 'default', savedWidth: 560 });

    expect(layout).toEqual({ mode: 'push', width: 476, dragMax: 476 });
  });

  it('covers the page when the drawer is expanded, at every width', () => {
    const offenders = MAINS.filter((main) => {
      const layout = drawerLayoutOf({ main, sizing: 'full', savedWidth: 400 });
      return layout.mode !== 'overlay' || layout.width !== Math.max(RIGHT_DRAWER_MIN, main - 16);
    });

    expect(offenders).toEqual([]);
  });
});

describe('the aside of each mode', () => {
  it('is 0 closed, the card plus both insets pushing, the card plus the handle gutter over the page', () => {
    expect(drawerAsideWidthOf({ width: 400, mode: 'closed' })).toBe(0);
    expect(drawerAsideWidthOf({ width: 400, mode: 'push' })).toBe(drawerTrackOf(400));
    expect(drawerAsideWidthOf({ width: 400, mode: 'overlay' })).toBe(400 + DRAWER_INSET);
  });
});

describe('drawer geometry across the width matrix', () => {
  it.each(MATRIX)(
    '$windowPx px at zoom $zoom, sidebar $sidebarPx, $sizing drawer: pushes only beside a 560px main, else overlays',
    ({ columnWidth, sizing }) => {
      const { drawerWidthPx, mode, mainPx } = layoutOf({ columnWidth, sizing });

      expect(drawerWidthPx).toBeGreaterThanOrEqual(RIGHT_DRAWER_MIN);
      if (mode === 'push') {
        expect(mainPx).toBeGreaterThanOrEqual(COLUMN_MIN_PUSH + COLUMN_GUTTERS);
        expect(mainPx + drawerTrackOf(drawerWidthPx)).toBe(columnWidth);
        expect(canDrawerPush({ mainWidthPx: columnWidth, drawerWidthPx })).toBe(true);
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

  it('reads the same answer from the width and mode helpers as from the layout', () => {
    const offenders = MATRIX.filter(({ columnWidth, sizing }) => {
      const layout = drawerLayoutOf({ main: columnWidth, sizing, savedWidth: 420 });
      return (
        drawerWidthOf({ sizing, columnWidth, resizableWidth: 420 }) !== layout.width ||
        drawerModeOf({ isOpen: true, sizing, columnWidth, drawerWidthPx: 420 }) !== layout.mode
      );
    });

    expect(offenders).toEqual([]);
  });

  it('pushes, at the saved width, before the column has been measured', () => {
    expect(drawerWidthOf({ sizing: 'default', columnWidth: null, resizableWidth: 420 })).toBe(420);
    expect(
      drawerModeOf({ isOpen: true, sizing: 'default', columnWidth: null, drawerWidthPx: 420 }),
    ).toBe('push');
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
    'slides clear of a wide artifact drawer at %i wide, or the drawer overlays',
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
