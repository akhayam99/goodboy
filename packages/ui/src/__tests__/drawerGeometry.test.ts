import { describe, expect, it } from 'vitest';
import { LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX } from '../components/AppShell';
import {
  COLUMN_FRAME,
  COLUMN_GUTTERS,
  COLUMN_MIN_PUSH,
  DRAWER_INSET,
  MEASURE_FRAME,
  DRAWER_TIERS,
  READER_DRAWER_DEFAULT,
  READER_DRAWER_MAX,
  READER_DRAWER_MIN,
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
const SIZINGS: ReadonlyArray<DrawerSizing> = ['side', 'reader'];
const TIERS = ['side', 'reader'] as const;

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
  savedWidth = sizing === 'reader' ? READER_DRAWER_DEFAULT : RIGHT_DRAWER_DEFAULT,
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
    expect(DRAWER_TIERS.side).toEqual({ min: 384, max: 560, fallback: 400 });
  });

  it('runs a reader drawer from 480 to 1000 and opens it at 720', () => {
    expect([READER_DRAWER_MIN, READER_DRAWER_DEFAULT, READER_DRAWER_MAX]).toEqual([480, 720, 1000]);
    expect(DRAWER_TIERS.reader).toEqual({ min: 480, max: 1000, fallback: 720 });
  });
});

describe.each(TIERS)('one push rule for the %s tier', (sizing) => {
  const tier = DRAWER_TIERS[sizing];
  const SAVED = [tier.min, tier.fallback, (tier.min + tier.max) / 2, tier.max];

  it.each(SAVED)(
    'pushes exactly when the page keeps 560 and the gutters beside a %i saved width, at every main from 600 to 2400',
    (savedWidth) => {
      const offenders = MAINS.filter((main) => {
        const layout = drawerLayoutOf({ main, sizing, savedWidth });
        const room = roomOf(main);
        const expected =
          room >= savedWidth
            ? { mode: 'push', width: savedWidth }
            : { mode: 'overlay', width: Math.min(savedWidth, main - 16) };
        return layout.mode !== expected.mode || layout.width !== expected.width;
      });

      expect(offenders).toEqual([]);
    },
  );

  it.each(SAVED)(
    'never squeezes a %i drawer: pushed, it is never narrower than saved',
    (savedWidth) => {
      const squeezed = MAINS.filter((main) => {
        const layout = drawerLayoutOf({ main, sizing, savedWidth });
        return layout.mode === 'push' && layout.width < savedWidth;
      });

      expect(squeezed).toEqual([]);
    },
  );

  it.each(SAVED)(
    'keeps the page container at 608 or more beside a %i drawer, at every main',
    (savedWidth) => {
      const cramped = MAINS.filter((main) => {
        const layout = drawerLayoutOf({ main, sizing, savedWidth });
        const pageWidth = mainWidthOf({
          columnWidth: main,
          mode: layout.mode,
          drawerWidthPx: layout.width,
        });
        return layout.mode === 'push' && pageWidth < COLUMN_MIN_PUSH + COLUMN_GUTTERS;
      });

      expect(cramped).toEqual([]);
    },
  );

  it('never returns to overlay once it pushes, as the page grows', () => {
    const modes = MAINS.map(
      (main) => drawerLayoutOf({ main, sizing, savedWidth: tier.fallback }).mode,
    );
    const firstPush = modes.indexOf('push');

    expect(firstPush).toBeGreaterThan(0);
    expect(modes.slice(0, firstPush).every((mode) => mode === 'overlay')).toBe(true);
    expect(modes.slice(firstPush).every((mode) => mode === 'push')).toBe(true);
    expect(MAINS[firstPush]).toBe(624 + tier.fallback);
  });

  it('never narrows as the page grows, within overlay and within push', () => {
    const layouts = MAINS.map((main) =>
      drawerLayoutOf({ main, sizing, savedWidth: tier.fallback }),
    );
    const narrowed = layouts.filter(
      (layout, index) =>
        index > 0 &&
        layouts[index - 1]?.mode === layout.mode &&
        layout.width < (layouts[index - 1]?.width ?? 0),
    );

    expect(narrowed).toEqual([]);
  });

  it('takes its drag ceiling from the room while it pushes, and from the page minus 16 over it', () => {
    const offenders = MAINS.filter((main) => {
      const layout = drawerLayoutOf({ main, sizing, savedWidth: tier.fallback });
      return layout.mode === 'push'
        ? layout.dragMax !== Math.min(tier.max, roomOf(main))
        : layout.dragMax !== Math.min(tier.max, main - 16);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps a pushed drawer pushed at every width up to its ceiling', () => {
    const offenders = MAINS.flatMap((main) => {
      const rest = drawerLayoutOf({ main, sizing, savedWidth: tier.fallback });
      if (rest.mode !== 'push') {
        return [];
      }
      return Array.from({ length: rest.dragMax - tier.min + 1 }, (_, step) => tier.min + step)
        .map((savedWidth) => ({
          main,
          savedWidth,
          layout: drawerLayoutOf({ main, sizing, savedWidth }),
        }))
        .filter(({ layout, savedWidth }) => layout.mode !== 'push' || layout.width !== savedWidth);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps an overlaid drawer inside the page up to its ceiling', () => {
    const offenders = MAINS.filter((main) => {
      const rest = drawerLayoutOf({ main, sizing, savedWidth: tier.fallback });
      return rest.mode === 'overlay' && rest.dragMax > main - 16;
    });

    expect(offenders).toEqual([]);
  });
});

describe('the named widths of the plan', () => {
  it('lies a side drawer over a 1000px main and pushes it at 1200', () => {
    expect(drawerLayoutOf({ main: 1000, sizing: 'side', savedWidth: 400 })).toEqual({
      mode: 'overlay',
      width: 400,
      dragMax: RIGHT_DRAWER_MAX,
    });
    expect(drawerLayoutOf({ main: 1200, sizing: 'side', savedWidth: 400 })).toEqual({
      mode: 'push',
      width: 400,
      dragMax: 560,
    });
  });

  it('lies a reader drawer over a 1440 window with the sidebar pinned and pushes it at 1920', () => {
    expect(drawerLayoutOf({ main: 1200, sizing: 'reader', savedWidth: 720 })).toEqual({
      mode: 'overlay',
      width: 720,
      dragMax: 1000,
    });
    expect(drawerLayoutOf({ main: 1680, sizing: 'reader', savedWidth: 720 })).toEqual({
      mode: 'push',
      width: 720,
      dragMax: 1000,
    });
  });

  it('pushes the reader at the page edge: 1344 is the first main that fits 720', () => {
    expect(drawerLayoutOf({ main: 1343, sizing: 'reader', savedWidth: 720 }).mode).toBe('overlay');
    expect(drawerLayoutOf({ main: 1344, sizing: 'reader', savedWidth: 720 }).mode).toBe('push');
  });

  it('keeps a reader over the page at min(saved, page - 16) on a narrow window', () => {
    expect(drawerLayoutOf({ main: 600, sizing: 'reader', savedWidth: 720 })).toMatchObject({
      mode: 'overlay',
      width: 584,
      dragMax: 584,
    });
    expect(drawerLayoutOf({ main: 900, sizing: 'reader', savedWidth: 1000 })).toMatchObject({
      mode: 'overlay',
      width: 884,
      dragMax: 884,
    });
  });

  it('overlays rather than squeezes a saved 560 side drawer, and keeps the saved width', () => {
    expect(drawerLayoutOf({ main: 1100, sizing: 'side', savedWidth: 560 })).toEqual({
      mode: 'overlay',
      width: 560,
      dragMax: 560,
    });
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
        expect(drawerWidthPx).toBe(
          sizing === 'reader' ? READER_DRAWER_DEFAULT : RIGHT_DRAWER_DEFAULT,
        );
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

  it('opens the reader drawer beside the work at 1920 and over it at 1440', () => {
    const at1920 = layoutOf({
      columnWidth: paneOf({ windowPx: 1920, zoom: 1, sidebarPx: LEFT_SIDEBAR_DEFAULT }),
      sizing: 'reader',
    });
    const at1440 = layoutOf({
      columnWidth: paneOf({ windowPx: 1440, zoom: 1, sidebarPx: LEFT_SIDEBAR_DEFAULT }),
      sizing: 'reader',
    });

    expect(at1920.mode).toBe('push');
    expect(at1440.mode).toBe('overlay');
  });

  it('keeps a closed drawer closed whatever the width', () => {
    expect(
      drawerModeOf({ isOpen: false, sizing: 'reader', columnWidth: 1600, drawerWidthPx: 400 }),
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
    expect(drawerWidthOf({ sizing: 'side', columnWidth: null, resizableWidth: 420 })).toBe(420);
    expect(
      drawerModeOf({ isOpen: true, sizing: 'side', columnWidth: null, drawerWidthPx: 420 }),
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
      expect(open.right).toBe(layoutOf({ columnWidth: paneWidth, sizing: 'side' }).mainPx);
    },
  );

  it.each(PANES)(
    'slides left clear of a default drawer at %i wide, keeping its width while it fits',
    (paneWidth) => {
      const rest = pageBoxOf({ paneWidth, tier: 'column', drawerWidthPx: null });
      const { drawerWidthPx, mode, mainPx } = layoutOf({
        columnWidth: paneWidth,
        sizing: 'side',
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
    'slides clear of a reader drawer at %i wide, or the drawer overlays',
    (paneWidth) => {
      const rest = pageBoxOf({ paneWidth, tier: 'column', drawerWidthPx: null });
      const { drawerWidthPx, mode, mainPx } = layoutOf({
        columnWidth: paneWidth,
        sizing: 'reader',
      });
      const open = pageBoxOf({ paneWidth, tier: 'column', drawerWidthPx, sizing: 'reader' });
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
      const { drawerWidthPx } = layoutOf({ columnWidth: paneWidth, sizing: 'side' });
      const rest = pageBoxOf({ paneWidth, tier: 'column', drawerWidthPx: null });
      const open = pageBoxOf({ paneWidth, tier: 'column', drawerWidthPx });

      expect(open.left).toBeLessThan(rest.left);
      expect(open.width).toBe(COLUMN_FRAME);
    },
  );

  it('shrinks beside the drawer while it pushes, and keeps the full column once it overlays', () => {
    const pushed = layoutOf({ columnWidth: 1100, sizing: 'side' });
    const overlaid = layoutOf({ columnWidth: 1000, sizing: 'side' });

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
