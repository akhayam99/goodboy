import { describe, expect, it } from 'vitest';
import { dockLayoutOf, type DockColumn, type DockPane } from '../dockLayout';
import { DOCK_TILE_ROOM_PX } from '../dockTileRoom';
import { DRAWER_TIERS, READER_DRAWER_DEFAULT, RIGHT_DRAWER_DEFAULT } from '../drawerGeometry';
import { SHELL_GUTTER_PX } from '../frameGeometry';
import { DESK_COLUMN_PX, isDeskColumnFolded } from '../isDeskColumnFolded';
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

const FIVE: ReadonlyArray<DockColumn> = [
  { panes: [TERMINAL, SCRIPTS] },
  { panes: [BROWSER, MONITOR] },
  { panes: [ASK] },
];

const ALL_FIVE = ['ask', 'browser', 'monitoring', 'scripts', 'terminal'];

type WidthParams = {
  readonly width: number;
};

const laneAt = ({ width }: WidthParams): number => {
  const form = shellRailFormOf({ windowWidth: width });
  const body =
    width -
    SHELL_RAIL_WIDTH_PX[form] -
    TOOL_RAIL_WIDTH_PX[form] -
    SHELL_GUTTER_PX -
    BODY_PADDING_PX;
  return isDeskColumnFolded({ bodyWidth: body }) ? body : body - DESK_COLUMN_PX - SHELL_GUTTER_PX;
};

const solvedAt = ({ width }: WidthParams) =>
  dockLayoutOf({
    windowWidth: laneAt({ width }),
    windowHeight: 1000,
    top: 0,
    leftRailWidth: 0,
    toolRailWidth: 0,
    isDesk: true,
    detail: null,
    columns: FIVE,
  });

type Solved = ReturnType<typeof solvedAt>;

type SolvedParams = {
  readonly layout: Solved;
};

const reachableOf = ({ layout }: SolvedParams): ReadonlyArray<string> =>
  layout.columns
    .flatMap((column) => column.panes)
    .flatMap((pane) => (pane.tabs.length > 0 ? pane.tabs : [pane.id]))
    .sort();

describe('the dock over the page when there is no room to tile', () => {
  it('keeps the room limit at the page, one column and three gutters', () => {
    expect(DOCK_TILE_ROOM_PX).toBeLessThanOrEqual(
      DESK_COLUMN_PX + DRAWER_TIERS.side.min + SHELL_GUTTER_PX * 3,
    );
    expect(DOCK_TILE_ROOM_PX).toBeGreaterThan(DESK_COLUMN_PX + DRAWER_TIERS.side.min);
  });

  it('folds the five tools into the room beside the page at 1100, none under its minimum', () => {
    const layout = solvedAt({ width: 1100 });

    expect(layout.mode).toBe('push');
    expect(reachableOf({ layout })).toEqual(ALL_FIVE);
    expect(layout.columns.length).toBeLessThan(FIVE.length);
    expect(layout.columns.every((column) => column.box.width >= DRAWER_TIERS.side.min)).toBe(true);
    expect(layout.columns[0]?.box.width).toBeGreaterThanOrEqual(DRAWER_TIERS.side.min);
  });

  it('folds everything into one tab strip at 900, still tiled', () => {
    const layout = solvedAt({ width: 900 });

    expect(laneAt({ width: 900 })).toBeGreaterThanOrEqual(DOCK_TILE_ROOM_PX);
    expect(layout.mode).toBe('push');
    expect(layout.columns).toHaveLength(1);
    expect(reachableOf({ layout })).toEqual(ALL_FIVE);
  });

  it.each([760, 800, 820])(
    'lies one panel over the page at %i with the other four as its tabs',
    (width) => {
      const layout = solvedAt({ width });
      const [column] = layout.columns;

      expect(laneAt({ width })).toBeLessThan(DOCK_TILE_ROOM_PX);
      expect(layout.mode).toBe('over');
      expect(layout.columns).toHaveLength(1);
      expect(column?.panes).toHaveLength(1);
      expect(reachableOf({ layout })).toEqual(ALL_FIVE);
      expect(column === undefined ? 0 : column.box.x + column.box.width).toBe(
        layout.page.x + layout.page.width,
      );
    },
  );

  it('tiles again at the first width that has the room', () => {
    const widths = Array.from({ length: 200 }, (_, index) => 700 + index);
    const first = widths.find((width) => laneAt({ width }) >= DOCK_TILE_ROOM_PX);

    expect(first).toBeDefined();
    expect(solvedAt({ width: (first ?? 0) - 1 }).mode).toBe('over');
    expect(solvedAt({ width: first ?? 0 }).mode).toBe('push');
  });
});
