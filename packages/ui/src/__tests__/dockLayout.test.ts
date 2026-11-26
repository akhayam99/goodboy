import { describe, expect, it } from 'vitest';
import { dockLayoutOf, type DockColumn, type DockPane } from '../dockLayout';
import {
  READER_DRAWER_DEFAULT,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MIN,
  pushReserveOf,
} from '../drawerGeometry';
import { SHELL_GUTTER_PX } from '../frameGeometry';
import {
  SHELL_RAIL_NARROW_BELOW_PX,
  SHELL_RAIL_WIDTH_PX,
  TOOL_RAIL_WIDTH_PX,
} from '../components/ShellRail/shellRailGeometry';

const HEIGHT = 900;
const TOP = 40;

const TERMINAL: DockPane = { id: 'terminal', sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT };
const SCRIPTS: DockPane = { id: 'scripts', sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT };
const ASK: DockPane = { id: 'ask', sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT };
const BROWSER: DockPane = { id: 'browser', sizing: 'browser', savedWidth: READER_DRAWER_DEFAULT };
const ARTIFACT: DockPane = { id: 'artifact', sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT };
const READER: DockPane = { id: 'plan', sizing: 'reader', savedWidth: READER_DRAWER_DEFAULT };

const SIZING_BY_ID = new Map(
  [TERMINAL, SCRIPTS, ASK, BROWSER, ARTIFACT, READER].map((pane) => [pane.id, pane.sizing]),
);

const NARROW: ReadonlyArray<DockColumn> = [{ panes: [TERMINAL] }];
const WIDE: ReadonlyArray<DockColumn> = [{ panes: [BROWSER] }];
const PAIR: ReadonlyArray<DockColumn> = [{ panes: [BROWSER] }, { panes: [TERMINAL] }];

type LayoutParams = {
  readonly width: number;
  readonly columns: ReadonlyArray<DockColumn>;
  readonly detail?: DockPane | null;
};

const layoutAt = ({ width, columns, detail = null }: LayoutParams) =>
  dockLayoutOf({
    windowWidth: width,
    windowHeight: HEIGHT,
    top: TOP,
    detail,
    columns,
  });

type Box = {
  readonly x: number;
  readonly width: number;
};

type RightParams = {
  readonly box: Box;
};

const rightOf = ({ box }: RightParams): number => box.x + box.width;

describe('the dock solver over the window table', () => {
  it.each([
    { width: 1440, page: 908 },
    { width: 1280, page: 748 },
    { width: 1024, page: 524 },
  ])('pushes one narrow pane at $width and keeps a page of $page', ({ width, page }) => {
    const layout = layoutAt({ width, columns: NARROW });

    expect(layout.mode).toBe('push');
    expect(layout.page.width).toBe(page);
  });

  it.each([1728, 1440, 1280])('pushes the browser alone at %i', (width) => {
    expect(layoutAt({ width, columns: WIDE }).mode).toBe('push');
  });

  it('shrinks the browser to keep a page of 612 at 1280', () => {
    const layout = layoutAt({ width: 1280, columns: WIDE });

    expect(layout.page.width).toBe(612);
    expect(layout.columns[0]?.box.width).toBe(536);
  });

  it('lays the browser over the page at 1024', () => {
    expect(layoutAt({ width: 1024, columns: WIDE }).mode).toBe('over');
  });

  it('keeps browser and terminal side by side at 1728 with a third pane under the terminal', () => {
    const layout = layoutAt({
      width: 1728,
      columns: [{ panes: [BROWSER] }, { panes: [TERMINAL, SCRIPTS] }],
    });

    expect(layout.mode).toBe('push');
    expect(layout.isStacked).toBe(false);
    expect(layout.page.width).toBe(612);
    expect(layout.columns.map((column) => column.panes.map((pane) => pane.id))).toEqual([
      ['browser'],
      ['terminal', 'scripts'],
    ]);
    expect(layout.columns[1]?.box.width).toBe(RIGHT_DRAWER_DEFAULT);
  });

  it.each([1440, 1280])(
    'stacks browser and terminal in one column at %i with a page of 612',
    (width) => {
      const layout = layoutAt({ width, columns: PAIR });

      expect(layout.mode).toBe('push');
      expect(layout.isStacked).toBe(true);
      expect(layout.page.width).toBe(612);
      expect(layout.columns).toHaveLength(1);
      expect(layout.columns[0]?.panes.map((pane) => pane.id)).toEqual(['browser', 'terminal']);
    },
  );

  it('puts browser and terminal side by side from 1620 and stacks them below', () => {
    expect(layoutAt({ width: 1620, columns: PAIR }).isStacked).toBe(false);
    expect(layoutAt({ width: 1619, columns: PAIR }).isStacked).toBe(true);
  });

  it('lays browser and terminal over the page at 1024', () => {
    const layout = layoutAt({ width: 1024, columns: PAIR });

    expect(layout.mode).toBe('over');
    expect(layout.page.width).toBe(1024 - 88);
  });

  it('keeps a detail beside a terminal at 1440 as three columns with no overlay', () => {
    const layout = layoutAt({ width: 1440, columns: NARROW, detail: ARTIFACT });

    expect(layout.mode).toBe('push');
    expect(layout.isDetailOver).toBe(false);
    expect(layout.page.width).toBe(pushReserveOf({ sizing: 'side' }) - SHELL_GUTTER_PX);
  });

  it('lays a wide detail over the page before the grid stops pushing', () => {
    const layout = layoutAt({ width: 1280, columns: NARROW, detail: READER });

    expect(layout.mode).toBe('push');
    expect(layout.isDetailOver).toBe(true);
    expect(layout.page.width).toBe(748);
    expect(layout.detail?.box).toMatchObject({ x: 64 + 748 - 720, width: 720 });
  });

  it('gives the whole room to the page with nothing open', () => {
    const layout = layoutAt({ width: 1440, columns: [] });

    expect(layout).toMatchObject({ mode: 'push', detail: null, columns: [] });
    expect(layout.page).toEqual({ x: 64, y: TOP, width: 1440 - 120, height: HEIGHT - TOP - 12 });
  });
});

describe('the order and the gutters of the frame', () => {
  it('runs page, detail, grid and rail left to right with a gutter of 12 between them', () => {
    const layout = layoutAt({
      width: 2400,
      columns: [{ panes: [BROWSER] }, { panes: [TERMINAL, SCRIPTS] }],
      detail: ARTIFACT,
    });
    const [first, second] = layout.columns;

    expect(layout.mode).toBe('push');
    expect(layout.detail?.box.x).toBe(rightOf({ box: layout.page }) + SHELL_GUTTER_PX);
    expect(first?.box.x).toBe(
      rightOf({ box: layout.detail?.box ?? layout.page }) + SHELL_GUTTER_PX,
    );
    expect(second?.box.x).toBe(rightOf({ box: first?.box ?? layout.page }) + SHELL_GUTTER_PX);
    expect(rightOf({ box: second?.box ?? layout.page })).toBe(layout.rail.x);
  });

  it('keeps 12 between two rows and 12 above the bottom of the window', () => {
    const layout = layoutAt({ width: 1440, columns: PAIR });
    const [upper, lower] = layout.columns[0]?.panes ?? [];

    expect((lower?.box.y ?? 0) - ((upper?.box.y ?? 0) + (upper?.box.height ?? 0))).toBe(
      SHELL_GUTTER_PX,
    );
    expect((lower?.box.y ?? 0) + (lower?.box.height ?? 0)).toBe(HEIGHT - SHELL_GUTTER_PX);
    expect(layout.page.y + layout.page.height).toBe(HEIGHT - SHELL_GUTTER_PX);
  });

  it.each([
    { width: 1024, columns: WIDE },
    { width: 1024, columns: PAIR },
    { width: 1440, columns: NARROW },
    { width: 1440, columns: PAIR },
    { width: 2400, columns: PAIR },
  ])('keeps the tool rail on the right edge of the window at $width', ({ width, columns }) => {
    const layout = layoutAt({ width, columns, detail: ARTIFACT });
    const last = layout.columns.at(-1);

    expect(rightOf({ box: layout.rail })).toBe(width);
    expect(rightOf({ box: last?.box ?? layout.page })).toBe(layout.rail.x);
  });

  it('opens the grid over the page to the left of the rail with a margin from the page edge', () => {
    const layout = layoutAt({ width: 1024, columns: PAIR, detail: ARTIFACT });
    const left = layout.detail?.box.x ?? 0;

    expect(layout.mode).toBe('over');
    expect(left).toBeGreaterThanOrEqual(layout.page.x + SHELL_GUTTER_PX * 2);
    expect(rightOf({ box: layout.columns.at(-1)?.box ?? layout.page })).toBe(layout.rail.x);
  });
});

describe('who gives way', () => {
  it('narrows the browser before any narrow pane', () => {
    const layout = layoutAt({
      width: 2100,
      columns: [{ panes: [BROWSER] }, { panes: [TERMINAL] }],
      detail: ARTIFACT,
    });

    expect(layout).toMatchObject({ mode: 'push', isStacked: false });
    expect(layout.detail?.box.width).toBe(RIGHT_DRAWER_DEFAULT);
    expect(layout.columns[1]?.box.width).toBe(RIGHT_DRAWER_DEFAULT);
    expect(layout.columns[0]?.box.width).toBeLessThan(READER_DRAWER_DEFAULT);
  });

  it('stacks two narrow panes beside a detail when three columns do not fit', () => {
    const layout = layoutAt({
      width: 1440,
      columns: [{ panes: [TERMINAL] }, { panes: [ASK] }],
      detail: ARTIFACT,
    });

    expect(layout).toMatchObject({ mode: 'push', isStacked: true, isDetailOver: false });
    expect(layout.columns[0]?.box.width).toBeGreaterThanOrEqual(RIGHT_DRAWER_MIN);
  });

  it('holds at most four columns of two panes', () => {
    const layout = layoutAt({
      width: 2600,
      columns: [
        { panes: [BROWSER] },
        { panes: [TERMINAL, SCRIPTS, ASK] },
        { panes: [ASK] },
        { panes: [ASK] },
        { panes: [ASK] },
      ],
    });

    expect(layout.columns.map((column) => column.panes.length)).toEqual([1, 2, 1, 1]);
  });

  const SHAPES: ReadonlyArray<{
    readonly columns: ReadonlyArray<DockColumn>;
    readonly detail: DockPane | null;
  }> = [
    { columns: NARROW, detail: null },
    { columns: WIDE, detail: null },
    { columns: PAIR, detail: null },
    { columns: PAIR, detail: ARTIFACT },
    { columns: [{ panes: [BROWSER] }, { panes: [TERMINAL, SCRIPTS] }], detail: READER },
    { columns: [{ panes: [TERMINAL] }, { panes: [ASK] }], detail: ARTIFACT },
  ];

  it('never pushes the page below its minimum at any window from 900 to 2600', () => {
    const offenders = SHAPES.flatMap(({ columns, detail }) =>
      Array.from({ length: 1701 }, (_, step) => 900 + step).flatMap((width) => {
        const layout = layoutAt({ width, columns, detail });
        if (layout.mode !== 'push') {
          return [];
        }
        const pushed = [
          ...(layout.isDetailOver || detail === null ? [] : [detail]),
          ...layout.columns.flatMap((column) => column.panes),
        ];
        const isSide = pushed.every(({ id }) => SIZING_BY_ID.get(id) === 'side');
        const min = pushReserveOf({ sizing: isSide ? 'side' : 'reader' }) - SHELL_GUTTER_PX;
        return layout.page.width >= min ? [] : [`${width}: ${layout.page.width} < ${min}`];
      }),
    );

    expect(offenders).toEqual([]);
  });
});

describe('a narrow window of 1024 by 700', () => {
  const SMALLEST = { windowWidth: 1024, windowHeight: 700, top: TOP } as const;

  it('turns both rails to icons only, 44 wide, and keeps the tool rail at the edge', () => {
    const layout = dockLayoutOf({ ...SMALLEST, detail: null, columns: [] });

    expect(layout.railForm).toBe('narrow');
    expect(layout.page.x).toBe(SHELL_RAIL_WIDTH_PX.narrow);
    expect(layout.rail).toMatchObject({ x: 1024 - TOOL_RAIL_WIDTH_PX.narrow, width: 44 });
  });

  it('pushes one narrow pane beside a page of 524', () => {
    const layout = dockLayoutOf({ ...SMALLEST, detail: null, columns: NARROW });
    const [column] = layout.columns;

    expect(layout.mode).toBe('push');
    expect(layout.page.width).toBe(524);
    expect(column?.box.x).toBe(rightOf({ box: layout.page }) + SHELL_GUTTER_PX);
    expect(rightOf({ box: column?.box ?? layout.page })).toBe(layout.rail.x);
    expect((column?.box.y ?? 0) + (column?.box.height ?? 0)).toBe(700 - SHELL_GUTTER_PX);
  });

  it('lays the browser over the page, to the left of the rail that stays at the edge', () => {
    const layout = dockLayoutOf({ ...SMALLEST, detail: null, columns: WIDE });
    const browser = layout.columns[0]?.box;

    expect(layout.mode).toBe('over');
    expect(layout.page).toMatchObject({ x: 44, width: 1024 - 88 });
    expect(rightOf({ box: browser ?? layout.page })).toBe(layout.rail.x);
    expect(rightOf({ box: layout.rail })).toBe(1024);
    expect(browser?.x).toBeGreaterThanOrEqual(layout.page.x + SHELL_GUTTER_PX * 2);
  });

  it('stacks browser and terminal in one column over the page', () => {
    const layout = dockLayoutOf({ ...SMALLEST, detail: null, columns: PAIR });

    expect(layout).toMatchObject({ mode: 'over', isStacked: true });
    expect(layout.columns[0]?.panes.map((pane) => pane.id)).toEqual(['browser', 'terminal']);
    expect(rightOf({ box: layout.columns[0]?.box ?? layout.page })).toBe(layout.rail.x);
  });

  it('keeps the rails wide from 1100 and narrow just below', () => {
    const wide = dockLayoutOf({
      ...SMALLEST,
      windowWidth: SHELL_RAIL_NARROW_BELOW_PX,
      detail: null,
      columns: [],
    });
    const narrow = dockLayoutOf({
      ...SMALLEST,
      windowWidth: SHELL_RAIL_NARROW_BELOW_PX - 1,
      detail: null,
      columns: [],
    });

    expect(wide.railForm).toBe('wide');
    expect(wide.rail.width).toBe(TOOL_RAIL_WIDTH_PX.wide);
    expect(narrow.railForm).toBe('narrow');
    expect(narrow.rail.width).toBe(TOOL_RAIL_WIDTH_PX.narrow);
  });
});

type TableCell = {
  readonly mode: 'push' | 'over';
  readonly isDetailOver: boolean;
  readonly isStacked?: boolean;
  readonly widths?: ReadonlyArray<number>;
};

type TableRow = {
  readonly name: string;
  readonly columns: ReadonlyArray<DockColumn>;
  readonly detail: DockPane | null;
  readonly at: Readonly<Record<1024 | 1280 | 1440 | 1920, TableCell>>;
};

const PUSHED = { mode: 'push', isDetailOver: false } as const;
const DETAIL_OVER = { mode: 'push', isDetailOver: true } as const;

const SIZING_TABLE: ReadonlyArray<TableRow> = [
  {
    name: 'nothing open',
    columns: [],
    detail: null,
    at: { 1024: PUSHED, 1280: PUSHED, 1440: PUSHED, 1920: PUSHED },
  },
  {
    name: 'Ask alone',
    columns: [],
    detail: ASK,
    at: {
      1024: { ...PUSHED, widths: [400] },
      1280: { ...PUSHED, widths: [400] },
      1440: { ...PUSHED, widths: [400] },
      1920: { ...PUSHED, widths: [400] },
    },
  },
  {
    name: 'a plan alone',
    columns: [],
    detail: READER,
    at: {
      1024: DETAIL_OVER,
      1280: { ...PUSHED, widths: [536] },
      1440: { ...PUSHED, widths: [696] },
      1920: { ...PUSHED, widths: [720] },
    },
  },
  {
    name: 'Ask and Terminal',
    columns: NARROW,
    detail: ASK,
    at: {
      1024: { ...DETAIL_OVER, widths: [400] },
      1280: { ...DETAIL_OVER, widths: [400] },
      1440: { ...PUSHED, widths: [396, 384] },
      1920: { ...PUSHED, widths: [400, 400] },
    },
  },
  {
    name: 'a plan and Terminal',
    columns: NARROW,
    detail: READER,
    at: {
      1024: { ...DETAIL_OVER, widths: [400] },
      1280: { ...DETAIL_OVER, widths: [400] },
      1440: { ...DETAIL_OVER, widths: [400] },
      1920: { ...PUSHED, widths: [720, 400] },
    },
  },
  {
    name: 'Terminal and Browser',
    columns: PAIR,
    detail: null,
    at: {
      1024: { mode: 'over', isDetailOver: false, isStacked: true },
      1280: { ...PUSHED, isStacked: true },
      1440: { ...PUSHED, isStacked: true },
      1920: { ...PUSHED, isStacked: false },
    },
  },
];

const PLAN_WIDTHS = [1024, 1280, 1440, 1920] as const;

describe('the sizing table of the plan: push, then shrink, then float the detail alone', () => {
  it.each(SIZING_TABLE.flatMap((row) => PLAN_WIDTHS.map((width) => ({ ...row, width }))))(
    'lays out $name at $width',
    ({ columns, detail, at, width }) => {
      const layout = layoutAt({ width, columns, detail });
      const expected = at[width];
      const pushedWidths = [
        ...(layout.detail !== null && !layout.isDetailOver ? [layout.detail.box.width] : []),
        ...layout.columns.map((column) => column.box.width),
      ];

      expect(layout.mode).toBe(expected.mode);
      expect(layout.isDetailOver).toBe(expected.isDetailOver);
      if (expected.isStacked !== undefined) {
        expect(layout.isStacked).toBe(expected.isStacked);
      }
      if (expected.widths !== undefined) {
        expect(pushedWidths).toEqual(expected.widths);
      }
    },
  );

  it.each(PLAN_WIDTHS)(
    'keeps the tools beside the page and floats only the detail at %i, three panels open',
    (width) => {
      const layout = layoutAt({ width, columns: PAIR, detail: READER });

      if (layout.mode === 'over') {
        expect(layout.isDetailOver).toBe(false);
        return;
      }
      expect(layout.page.width).toBeGreaterThanOrEqual(
        pushReserveOf({ sizing: 'reader' }) - SHELL_GUTTER_PX * 2,
      );
    },
  );

  it('lays everything over the page when pushing is barred, whatever the room', () => {
    const layout = dockLayoutOf({
      windowWidth: 2600,
      windowHeight: HEIGHT,
      top: TOP,
      detail: READER,
      columns: [],
      canPush: false,
    });

    expect(layout.mode).toBe('over');
    expect(layout.detail?.box.width).toBe(READER_DRAWER_DEFAULT);
  });
});
