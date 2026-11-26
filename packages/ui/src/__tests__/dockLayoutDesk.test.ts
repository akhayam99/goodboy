import { describe, expect, it } from 'vitest';
import { dockLayoutOf, type DockColumn, type DockPane } from '../dockLayout';
import { READER_DRAWER_DEFAULT, RIGHT_DRAWER_DEFAULT } from '../drawerGeometry';
import { SHELL_GUTTER_PX } from '../frameGeometry';
import { DESK_COLUMN_PX, isDeskColumnFolded } from '../isDeskColumnFolded';
import { DRAWER_TIERS } from '../drawerGeometry';
import { shellRailFormOf } from '../components/ShellRail/shellRailFormOf';
import { SHELL_RAIL_WIDTH_PX, TOOL_RAIL_WIDTH_PX } from '../components/ShellRail/shellRailGeometry';

const BODY_PADDING_PX = 32;

const TERMINAL: DockPane = {
  id: 'terminal',
  sizing: 'side',
  savedWidth: RIGHT_DRAWER_DEFAULT,
  rowMin: 200,
};
const BROWSER: DockPane = {
  id: 'browser',
  sizing: 'browser',
  savedWidth: READER_DRAWER_DEFAULT,
  rowMin: 240,
};
const MONITOR: DockPane = {
  id: 'monitoring',
  sizing: 'side',
  savedWidth: RIGHT_DRAWER_DEFAULT,
  rowMin: 180,
};
const SCRIPTS: DockPane = { id: 'scripts', sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT };
const ASK: DockPane = { id: 'ask', sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT };
const AGENT: DockPane = { id: 'detail', sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT };

const FOUR_CELLS: ReadonlyArray<DockColumn> = [
  { panes: [BROWSER] },
  { panes: [TERMINAL, MONITOR] },
];

const PLAN_WIDTHS = [1024, 1440, 1920] as const;

type WindowParams = {
  readonly width: number;
};

const bodyAt = ({ width }: WindowParams): number => {
  const form = shellRailFormOf({ windowWidth: width });
  return (
    width - SHELL_RAIL_WIDTH_PX[form] - TOOL_RAIL_WIDTH_PX[form] - SHELL_GUTTER_PX - BODY_PADDING_PX
  );
};

const laneAt = ({ width }: WindowParams): number => {
  const body = bodyAt({ width });
  return isDeskColumnFolded({ bodyWidth: body }) ? body : body - DESK_COLUMN_PX - SHELL_GUTTER_PX;
};

type DeskParams = {
  readonly lane: number;
  readonly columns: ReadonlyArray<DockColumn>;
  readonly detail?: DockPane | null;
  readonly height?: number;
  readonly foldOrder?: ReadonlyArray<string>;
};

const deskOf = ({ lane, columns, detail = null, height = 1000, foldOrder = [] }: DeskParams) =>
  dockLayoutOf({
    windowWidth: lane,
    windowHeight: height,
    foldOrder,
    top: 0,
    leftRailWidth: 0,
    toolRailWidth: 0,
    isDesk: true,
    detail,
    columns,
  });

type Layout = ReturnType<typeof deskOf>;

type LayoutParams = {
  readonly layout: Layout;
};

const usedOf = ({ layout }: LayoutParams): number => {
  const boxes = [
    ...(layout.detail === null ? [] : [layout.detail.box]),
    ...layout.columns.map((column) => column.box),
  ];
  return (
    boxes.reduce((total, box) => total + box.width, 0) +
    SHELL_GUTTER_PX * Math.max(0, boxes.length - 1)
  );
};

const reachableOf = ({ layout }: LayoutParams): ReadonlyArray<string> =>
  [
    ...(layout.detail === null ? [] : layout.detail.panes),
    ...layout.columns.flatMap((column) => column.panes),
  ]
    .flatMap((pane) => (pane.tabs.length > 0 ? pane.tabs : [pane.id]))
    .sort();

describe('the desk is a frame of its own: the column, then the grid over the rest', () => {
  it.each(PLAN_WIDTHS)('reaches Terminal, Browser, Monitor and the detail at %i', (width) => {
    const layout = deskOf({ lane: laneAt({ width }), columns: FOUR_CELLS, detail: AGENT });

    expect(reachableOf({ layout })).toEqual(['browser', 'detail', 'monitoring', 'terminal']);
    expect(layout.mode).toBe('push');
    expect(layout.isDetailOver).toBe(false);
  });

  it('puts the four cells side by side at 1920, with no tab', () => {
    const layout = deskOf({ lane: laneAt({ width: 1920 }), columns: FOUR_CELLS, detail: AGENT });

    expect(layout.columns.map((column) => column.panes.map((pane) => pane.id))).toEqual([
      ['browser'],
      ['terminal', 'monitoring'],
    ]);
    expect(
      layout.columns.flatMap((column) => column.panes).every((pane) => pane.tabs.length === 0),
    ).toBe(true);
  });

  it.each([1024, 1440])(
    'turns the tools beyond the second into tabs of one cell at %i',
    (width) => {
      const layout = deskOf({ lane: laneAt({ width }), columns: FOUR_CELLS, detail: AGENT });
      const cells = layout.columns.flatMap((column) => column.panes);

      expect(cells.map((pane) => pane.id)).toEqual(['browser', 'terminal']);
      expect(cells[1]?.tabs).toEqual(['terminal', 'monitoring']);
    },
  );

  it.each(PLAN_WIDTHS)(
    'fills the lane to its edge at %i, so no area beside the column stays empty',
    (width) => {
      const lane = laneAt({ width });

      expect(usedOf({ layout: deskOf({ lane, columns: [{ panes: [TERMINAL] }] }) })).toBe(lane);
      expect(usedOf({ layout: deskOf({ lane, columns: FOUR_CELLS, detail: AGENT }) })).toBe(lane);
      expect(usedOf({ layout: deskOf({ lane, columns: [], detail: AGENT }) })).toBe(lane);
    },
  );

  it('lets one terminal take the whole lane: the page is the desk column beside it', () => {
    const lane = laneAt({ width: 1440 });
    const layout = deskOf({ lane, columns: [{ panes: [TERMINAL] }] });

    expect(layout.columns[0]?.box.width).toBe(lane);
    expect(layout.page.width).toBe(lane);
  });

  it('stacks Browser and Terminal beside the detail before any tab', () => {
    const layout = deskOf({
      lane: laneAt({ width: 1440 }),
      columns: [{ panes: [BROWSER] }, { panes: [TERMINAL] }],
      detail: AGENT,
    });

    expect(layout.isStacked).toBe(true);
    expect(layout.columns[0]?.panes.map((pane) => [pane.id, pane.tabs])).toEqual([
      ['browser', []],
      ['terminal', []],
    ]);
  });
});

describe('the desk column folds under 880 of page beside it', () => {
  it.each([
    { width: 1024, isFolded: true },
    { width: 1440, isFolded: false },
    { width: 1920, isFolded: false },
  ])('folds the column at $width: $isFolded', ({ width, isFolded }) => {
    expect(isDeskColumnFolded({ bodyWidth: bodyAt({ width }) })).toBe(isFolded);
  });

  it('keeps the column while the page beside it is 880 and folds it one pixel below', () => {
    const edge = DESK_COLUMN_PX + SHELL_GUTTER_PX + 880;

    expect(isDeskColumnFolded({ bodyWidth: edge })).toBe(false);
    expect(isDeskColumnFolded({ bodyWidth: edge - 1 })).toBe(true);
  });
});

const FIVE: ReadonlyArray<DockPane> = [TERMINAL, BROWSER, SCRIPTS, ASK, MONITOR];

const SWEEP_WIDTHS = Array.from({ length: 42 }, (_, index) => 900 + index * 40);

const GRID_CAP_PANELS = 4;

type PanesParams = {
  readonly panes: ReadonlyArray<DockPane>;
};

const subsetsOf = ({ panes }: PanesParams): ReadonlyArray<ReadonlyArray<DockPane>> =>
  Array.from({ length: 2 ** panes.length - 1 }, (_, mask) =>
    panes.filter((_pane, index) => ((mask + 1) >> index) % 2 === 1),
  ).filter((subset) => subset.length <= GRID_CAP_PANELS);

const columnsOf = ({ panes }: PanesParams): ReadonlyArray<DockColumn> => {
  const [first, second, third, fourth] = panes;
  const left = [first, third].flatMap((pane) => pane ?? []);
  const right = [second, fourth].flatMap((pane) => pane ?? []);
  return [left, right].filter((column) => column.length > 0).map((column) => ({ panes: column }));
};

const sizingOf = ({ id }: { readonly id: string }) =>
  [...FIVE, AGENT].find((pane) => pane.id === id)?.sizing ?? 'side';

const minOf = ({ ids }: { readonly ids: ReadonlyArray<string> }): number =>
  Math.max(...ids.map((id) => DRAWER_TIERS[sizingOf({ id })].min));

describe('the desk never squeezes: a panel keeps its minimum or the layout lies over', () => {
  it('keeps every panel at its tier minimum for 900 to 2560 and every subset of the tools', () => {
    const breaches = SWEEP_WIDTHS.flatMap((width) =>
      subsetsOf({ panes: FIVE }).flatMap((panes) =>
        [null, AGENT].flatMap((detail) => {
          const layout = deskOf({
            lane: laneAt({ width }),
            columns: columnsOf({ panes }),
            detail,
          });
          const placed = [...(layout.detail === null ? [] : [layout.detail]), ...layout.columns];
          const expected = [
            ...panes.map((pane) => pane.id),
            ...(detail === null ? [] : ['detail']),
          ];
          const isLost = reachableOf({ layout }).join() !== [...expected].sort().join();
          const isUnder = placed.some(
            (column) =>
              column.box.width <
              minOf({
                ids: column.panes.flatMap((pane) => (pane.tabs.length > 0 ? pane.tabs : [pane.id])),
              }),
          );
          return isLost || isUnder ? [{ width, ids: expected.join('/'), mode: layout.mode }] : [];
        }),
      ),
    );

    expect(breaches).toEqual([]);
  });

  it('keeps the desk column at its 300 pixels whenever the lane is solved', () => {
    const widths = SWEEP_WIDTHS.map((width) => {
      const body = bodyAt({ width });
      return isDeskColumnFolded({ bodyWidth: body }) ? DESK_COLUMN_PX : body - laneAt({ width });
    });

    expect(widths.every((value) => value >= DESK_COLUMN_PX)).toBe(true);
  });

  it('lies over the detail below the room of a detail and a Browser, with no panel squeezed', () => {
    const layout = deskOf({ lane: 860, columns: [{ panes: [BROWSER] }], detail: AGENT });

    expect(layout.mode).toBe('over');
    expect(layout.detail?.box.width).toBe(RIGHT_DRAWER_DEFAULT);
    expect(layout.columns[0]?.box.width).toBe(DRAWER_TIERS.browser.min);
  });

  it('stays side by side from the room of a detail and a Browser, one pixel above it', () => {
    const room = DRAWER_TIERS.side.min + SHELL_GUTTER_PX + DRAWER_TIERS.browser.min;

    expect(deskOf({ lane: room, columns: [{ panes: [BROWSER] }], detail: AGENT }).mode).toBe(
      'push',
    );
    expect(deskOf({ lane: room - 1, columns: [{ panes: [BROWSER] }], detail: AGENT }).mode).toBe(
      'over',
    );
  });

  it('refuses a stack that is under its row minimums and folds into a tab instead', () => {
    const layout = deskOf({
      lane: laneAt({ width: 1440 }),
      columns: [{ panes: [BROWSER] }, { panes: [TERMINAL] }],
      detail: AGENT,
      height: 400,
    });

    expect(layout.isStacked).toBe(false);
    expect(layout.columns.flatMap((column) => column.panes.map((pane) => pane.tabs))).toEqual([
      ['browser', 'terminal'],
    ]);
  });
});

describe('the fold order decides which cell becomes a tab', () => {
  const lane = laneAt({ width: 1440 });
  const columns: ReadonlyArray<DockColumn> = [{ panes: [BROWSER] }, { panes: [TERMINAL, MONITOR] }];

  it('folds the last cell into its neighbor by default', () => {
    const cells = deskOf({ lane, columns, detail: AGENT }).columns.flatMap(
      (column) => column.panes,
    );

    expect(cells.map((pane) => [pane.id, pane.tabs])).toEqual([
      ['browser', []],
      ['terminal', ['terminal', 'monitoring']],
    ]);
  });

  it('folds the named cell first and keeps the other as the host of the tab', () => {
    const cells = deskOf({
      lane,
      columns,
      detail: AGENT,
      foldOrder: ['terminal', 'monitoring', 'browser'],
    }).columns.flatMap((column) => column.panes);

    expect(cells.map((pane) => [pane.id, pane.tabs])).toEqual([
      ['browser', []],
      ['monitoring', ['monitoring', 'terminal']],
    ]);
  });

  it('gives the same layout after the room shrinks and grows back, and never edits the intent', () => {
    const intent = structuredClone(columns);
    const wide = laneAt({ width: 1920 });
    const before = deskOf({ lane: wide, columns, detail: AGENT });

    deskOf({ lane: 900, columns, detail: AGENT });
    const after = deskOf({ lane: wide, columns, detail: AGENT });

    expect(after).toEqual(before);
    expect(columns).toEqual(intent);
  });
});
