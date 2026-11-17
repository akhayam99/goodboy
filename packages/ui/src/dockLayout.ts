import { DRAWER_TIERS, pushReserveOf, type DrawerSizing } from './drawerGeometry';
import { DOCK_GRID_CAP } from './dockGridCap';
import { SHELL_GUTTER_PX } from './frameGeometry';
import type { ShellRailForm } from './components/ShellRail/shellRailFormContext';
import { shellRailFormOf } from './components/ShellRail/shellRailFormOf';
import { SHELL_RAIL_WIDTH_PX, TOOL_RAIL_WIDTH_PX } from './components/ShellRail/shellRailGeometry';

const DOCK_MAX_COLUMNS = DOCK_GRID_CAP.columns;
const DOCK_MAX_ROWS = DOCK_GRID_CAP.rows;
const EVEN_ROW_SHARE = 0.5;
const BROWSER_ROW_SHARE = 0.58;
const OVER_PAGE_MARGIN_PX = SHELL_GUTTER_PX * 2;

const SIZING_RANK: Readonly<Record<DrawerSizing, number>> = { side: 0, reader: 1, browser: 2 };
const SHRINK_ORDER: ReadonlyArray<DrawerSizing> = ['browser', 'reader', 'side'];

export type DockPane = {
  readonly id: string;
  readonly sizing: DrawerSizing;
  readonly savedWidth: number;
};

export type DockColumn = {
  readonly panes: ReadonlyArray<DockPane>;
  readonly savedWidth?: number;
  readonly split?: number;
};

type DockBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type PlacedPane = {
  readonly id: string;
  readonly box: DockBox;
};

type PlacedColumn = {
  readonly box: DockBox;
  readonly dragMax: number;
  readonly panes: ReadonlyArray<PlacedPane>;
};

type DockLayout = {
  readonly railForm: ShellRailForm;
  readonly mode: 'push' | 'over';
  readonly isStacked: boolean;
  readonly isDetailOver: boolean;
  readonly page: DockBox;
  readonly detail: PlacedColumn | null;
  readonly columns: ReadonlyArray<PlacedColumn>;
  readonly rail: DockBox;
};

type FrameLayout = Omit<DockLayout, 'rail' | 'railForm'>;

type Lane = {
  readonly panes: ReadonlyArray<DockPane>;
  readonly sizing: DrawerSizing;
  readonly savedWidth: number;
  readonly split: number;
};

type Frame = {
  readonly top: number;
  readonly height: number;
  readonly mainLeft: number;
  readonly mainWidth: number;
  readonly railLeft: number;
};

type SumParams = {
  readonly values: ReadonlyArray<number>;
};

const sumOf = ({ values }: SumParams): number => values.reduce((total, value) => total + value, 0);

type ClampParams = {
  readonly lane: Lane;
};

const wantedWidthOf = ({ lane }: ClampParams): number => {
  const tier = DRAWER_TIERS[lane.sizing];
  return Math.min(tier.max, Math.max(tier.min, lane.savedWidth));
};

type LaneParams = {
  readonly panes: ReadonlyArray<DockPane>;
  readonly savedWidth?: number;
  readonly split?: number;
};

const laneOf = ({ panes, savedWidth, split }: LaneParams): Lane | null => {
  const rows = panes.slice(0, DOCK_MAX_ROWS);
  const lead = rows.reduce<DockPane | null>(
    (best, pane) =>
      best === null || SIZING_RANK[pane.sizing] > SIZING_RANK[best.sizing] ? pane : best,
    null,
  );
  if (lead === null) {
    return null;
  }
  const first = rows[0];
  return {
    panes: rows,
    sizing: lead.sizing,
    savedWidth: savedWidth ?? lead.savedWidth,
    split: split ?? (first?.sizing === 'browser' ? BROWSER_ROW_SHARE : EVEN_ROW_SHARE),
  };
};

type FoldParams = {
  readonly lanes: ReadonlyArray<Lane>;
};

const foldedOf = ({ lanes }: FoldParams): ReadonlyArray<Lane> | null => {
  const [left, right] = lanes;
  if (lanes.length !== 2 || left === undefined || right === undefined) {
    return null;
  }
  if (left.panes.length !== 1 || right.panes.length !== 1) {
    return null;
  }
  const lead = SIZING_RANK[right.sizing] > SIZING_RANK[left.sizing] ? right : left;
  const folded = laneOf({ panes: [...left.panes, ...right.panes], savedWidth: lead.savedWidth });
  return folded === null ? null : [folded];
};

type FitParams = {
  readonly lanes: ReadonlyArray<Lane>;
  readonly mainWidth: number;
};

type Fit = {
  readonly widths: ReadonlyArray<number>;
  readonly room: number;
};

const pushFitOf = ({ lanes, mainWidth }: FitParams): Fit | null => {
  if (lanes.length === 0) {
    return { widths: [], room: mainWidth };
  }
  const sizing = lanes.every((lane) => lane.sizing === 'side') ? 'side' : 'reader';
  const room =
    mainWidth - pushReserveOf({ sizing }) - SHELL_GUTTER_PX * Math.max(0, lanes.length - 1);
  const mins = lanes.map((lane) => DRAWER_TIERS[lane.sizing].min);
  if (sumOf({ values: mins }) > room) {
    return null;
  }
  const wanted = lanes.map((lane) => wantedWidthOf({ lane }));
  const slots = lanes.map((lane, index) => ({
    index,
    sizing: lane.sizing,
    min: DRAWER_TIERS[lane.sizing].min,
  }));
  const order = SHRINK_ORDER.flatMap((sizing) =>
    slots.filter((slot) => slot.sizing === sizing).reverse(),
  );
  const shrunk = order.reduce(
    (acc, slot) => {
      const width = acc.widths[slot.index] ?? slot.min;
      const take = Math.max(0, Math.min(acc.excess, width - slot.min));
      return {
        widths: acc.widths.map((value, index) => (index === slot.index ? value - take : value)),
        excess: acc.excess - take,
      };
    },
    { widths: wanted, excess: sumOf({ values: wanted }) - room },
  );
  return { widths: shrunk.widths, room };
};

type RowsParams = {
  readonly lane: Lane;
  readonly box: DockBox;
};

const rowsOf = ({ lane, box }: RowsParams): ReadonlyArray<PlacedPane> => {
  const [first, second] = lane.panes;
  if (first === undefined) {
    return [];
  }
  if (second === undefined) {
    return [{ id: first.id, box }];
  }
  const shared = Math.max(0, box.height - SHELL_GUTTER_PX);
  const topHeight = Math.round(shared * lane.split);
  return [
    { id: first.id, box: { ...box, height: topHeight } },
    {
      id: second.id,
      box: { ...box, y: box.y + topHeight + SHELL_GUTTER_PX, height: shared - topHeight },
    },
  ];
};

type PlaceParams = {
  readonly frame: Frame;
  readonly lanes: ReadonlyArray<Lane>;
  readonly widths: ReadonlyArray<number>;
  readonly lefts: ReadonlyArray<number>;
  readonly slack: number;
};

const placedOf = ({
  frame,
  lanes,
  widths,
  lefts,
  slack,
}: PlaceParams): ReadonlyArray<PlacedColumn> =>
  lanes.map((lane, index) => {
    const width = widths[index] ?? 0;
    const box = { x: lefts[index] ?? 0, y: frame.top, width, height: frame.height };
    return {
      box,
      dragMax: Math.min(DRAWER_TIERS[lane.sizing].max, width + slack),
      panes: rowsOf({ lane, box }),
    };
  });

type LeftsParams = {
  readonly start: number;
  readonly widths: ReadonlyArray<number>;
};

const leftsOf = ({ start, widths }: LeftsParams): ReadonlyArray<number> =>
  widths.map(
    (_, index) => start + sumOf({ values: widths.slice(0, index) }) + SHELL_GUTTER_PX * index,
  );

type OverDetailParams = {
  readonly frame: Frame;
  readonly lane: Lane;
  readonly page: DockBox;
};

const detailOverOf = ({ frame, lane, page }: OverDetailParams): PlacedColumn => {
  const room = Math.max(0, page.width - OVER_PAGE_MARGIN_PX);
  const width = Math.min(wantedWidthOf({ lane }), room);
  const box = { x: page.x + page.width - width, y: frame.top, width, height: frame.height };
  return {
    box,
    dragMax: Math.min(DRAWER_TIERS[lane.sizing].max, room),
    panes: rowsOf({ lane, box }),
  };
};

type TryParams = {
  readonly frame: Frame;
  readonly detail: Lane | null;
  readonly lanes: ReadonlyArray<Lane>;
  readonly isStacked: boolean;
  readonly isDetailOver: boolean;
};

const pushLayoutOf = ({
  frame,
  detail,
  lanes,
  isStacked,
  isDetailOver,
}: TryParams): FrameLayout | null => {
  const pushed = detail === null || isDetailOver ? lanes : [detail, ...lanes];
  const fit = pushFitOf({ lanes: pushed, mainWidth: frame.mainWidth });
  if (fit === null) {
    return null;
  }
  const used = sumOf({ values: fit.widths });
  const pageWidth = frame.mainWidth - used - SHELL_GUTTER_PX * pushed.length;
  const page = { x: frame.mainLeft, y: frame.top, width: pageWidth, height: frame.height };
  const placed = placedOf({
    frame,
    lanes: pushed,
    widths: fit.widths,
    lefts: leftsOf({ start: frame.mainLeft + pageWidth + SHELL_GUTTER_PX, widths: fit.widths }),
    slack: fit.room - used,
  });
  if (detail === null) {
    return { mode: 'push', isStacked, isDetailOver: false, page, detail: null, columns: placed };
  }
  if (isDetailOver) {
    return {
      mode: 'push',
      isStacked,
      isDetailOver: true,
      page,
      detail: detailOverOf({ frame, lane: detail, page }),
      columns: placed,
    };
  }
  const [placedDetail, ...columns] = placed;
  return {
    mode: 'push',
    isStacked,
    isDetailOver: false,
    page,
    detail: placedDetail ?? null,
    columns,
  };
};

type OverParams = {
  readonly frame: Frame;
  readonly detail: Lane | null;
  readonly lanes: ReadonlyArray<Lane>;
  readonly isStacked: boolean;
};

const overLayoutOf = ({ frame, detail, lanes, isStacked }: OverParams): FrameLayout => {
  const over = detail === null ? lanes : [detail, ...lanes];
  const cap = Math.max(
    0,
    frame.mainWidth - OVER_PAGE_MARGIN_PX - SHELL_GUTTER_PX * Math.max(0, over.length - 1),
  );
  const wanted = over.map((lane) => wantedWidthOf({ lane }));
  const total = sumOf({ values: wanted });
  const scale = total > cap ? cap / total : 1;
  const widths = wanted.map((width) => Math.floor(width * scale));
  const used = sumOf({ values: widths });
  const start = frame.railLeft - used - SHELL_GUTTER_PX * Math.max(0, over.length - 1);
  const placed = placedOf({
    frame,
    lanes: over,
    widths,
    lefts: leftsOf({ start, widths }),
    slack: cap - used,
  });
  const page = { x: frame.mainLeft, y: frame.top, width: frame.mainWidth, height: frame.height };
  if (detail === null) {
    return { mode: 'over', isStacked, isDetailOver: false, page, detail: null, columns: placed };
  }
  const [placedDetail, ...columns] = placed;
  return {
    mode: 'over',
    isStacked,
    isDetailOver: false,
    page,
    detail: placedDetail ?? null,
    columns,
  };
};

type Params = {
  readonly windowWidth: number;
  readonly windowHeight: number;
  readonly top: number;
  readonly leftRailWidth?: number;
  readonly toolRailWidth?: number;
  readonly detail: DockPane | null;
  readonly columns: ReadonlyArray<DockColumn>;
};

export const dockLayoutOf = ({
  windowWidth,
  windowHeight,
  top,
  leftRailWidth,
  toolRailWidth,
  detail,
  columns,
}: Params): DockLayout => {
  const railForm = shellRailFormOf({ windowWidth });
  const leftWidth = leftRailWidth ?? SHELL_RAIL_WIDTH_PX[railForm];
  const toolWidth = toolRailWidth ?? TOOL_RAIL_WIDTH_PX[railForm];
  const railLeft = windowWidth - toolWidth;
  const frame: Frame = {
    top,
    height: Math.max(0, windowHeight - top - SHELL_GUTTER_PX),
    mainLeft: leftWidth,
    mainWidth: Math.max(0, railLeft - leftWidth),
    railLeft,
  };
  const rail = {
    x: railLeft,
    y: top,
    width: toolWidth,
    height: Math.max(0, windowHeight - top),
  };
  const detailLane = detail === null ? null : laneOf({ panes: [detail] });
  const intent = columns
    .slice(0, DOCK_MAX_COLUMNS)
    .map((column) => laneOf(column))
    .filter((lane): lane is Lane => lane !== null);
  const folded = foldedOf({ lanes: intent });
  const hasDetail = detailLane !== null;
  const tries: ReadonlyArray<TryParams> = [
    { frame, detail: detailLane, lanes: intent, isStacked: false, isDetailOver: false },
    ...(folded === null
      ? []
      : [{ frame, detail: detailLane, lanes: folded, isStacked: true, isDetailOver: false }]),
    ...(hasDetail
      ? [{ frame, detail: detailLane, lanes: intent, isStacked: false, isDetailOver: true }]
      : []),
    ...(hasDetail && folded !== null
      ? [{ frame, detail: detailLane, lanes: folded, isStacked: true, isDetailOver: true }]
      : []),
  ];
  const pushed = tries.reduce<FrameLayout | null>(
    (found, attempt) => found ?? pushLayoutOf(attempt),
    null,
  );
  if (pushed !== null) {
    return { ...pushed, railForm, rail };
  }
  return {
    railForm,
    ...overLayoutOf({
      frame,
      detail: detailLane,
      lanes: folded ?? intent,
      isStacked: folded !== null,
    }),
    rail,
  };
};
