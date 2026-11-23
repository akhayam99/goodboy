import { describe, expect, it } from 'vitest';
import { dockLayoutOf, type DockColumn, type DockPane } from '../dockLayout';
import { READER_DRAWER_DEFAULT, RIGHT_DRAWER_DEFAULT } from '../drawerGeometry';
import { SHELL_GUTTER_PX } from '../frameGeometry';
import { isDeskColumnFolded } from '../isDeskColumnFolded';
import { shellRailFormOf } from '../components/ShellRail/shellRailFormOf';
import { SHELL_RAIL_WIDTH_PX, TOOL_RAIL_WIDTH_PX } from '../components/ShellRail/shellRailGeometry';

const DESK_COLUMN_PX = 300;
const BODY_PADDING_PX = 32;

const TERMINAL: DockPane = { id: 'terminal', sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT };
const BROWSER: DockPane = { id: 'browser', sizing: 'browser', savedWidth: READER_DRAWER_DEFAULT };
const MONITOR: DockPane = { id: 'monitoring', sizing: 'reader', savedWidth: READER_DRAWER_DEFAULT };
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
};

const deskOf = ({ lane, columns, detail = null }: DeskParams) =>
  dockLayoutOf({
    windowWidth: lane,
    windowHeight: 1000,
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

  it('gives the page no minimum on the desk: one terminal takes the whole lane', () => {
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
