import { DRAWER_TIERS, pushReserveOf, type DrawerSizing } from './drawerGeometry';
import { DOCK_GRID_CAP } from './dockGridCap';
import { foldStatesOf } from './dockFoldStates';
import { laneOf } from './dockLaneOf';
import type { DockColumn, DockPane, Lane } from './dockLaneTypes';
import { SIZING_RANK } from './dockSizingRank';
import { SHELL_GUTTER_PX } from './frameGeometry';
import type { ShellRailForm } from './components/ShellRail/shellRailFormContext';
import { shellRailFormOf } from './components/ShellRail/shellRailFormOf';
import { SHELL_RAIL_WIDTH_PX, TOOL_RAIL_WIDTH_PX } from './components/ShellRail/shellRailGeometry';
import type { SolvedDockFrame } from './dockGridFrameOf';
import type { DockSolveParams } from './useDockGrid';

const DOCK_MAX_COLUMNS = DOCK_GRID_CAP.columns;
const OVER_PAGE_MARGIN_PX = SHELL_GUTTER_PX * 2;

const SHRINK_ORDER: ReadonlyArray<DrawerSizing> = ['browser', 'reader', 'side'];

export type { DockColumn, DockPane } from './dockLaneTypes';

type DockBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type PlacedPane = {
  readonly id: string;
  readonly box: DockBox;
  readonly tabs: ReadonlyArray<string>;
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

type ShrinkParams = {
  readonly lanes: ReadonlyArray<Lane>;
  readonly wanted: ReadonlyArray<number>;
  readonly room: number;
};

const shrunkOf = ({ lanes, wanted, room }: ShrinkParams): ReadonlyArray<number> => {
  const slots = lanes.map((lane, index) => ({
    index,
    sizing: lane.sizing,
    min: DRAWER_TIERS[lane.sizing].min,
  }));
  const order = SHRINK_ORDER.flatMap((sizing) =>
    slots.filter((slot) => slot.sizing === sizing).reverse(),
  );
  return order.reduce(
    (acc, slot) => {
      const width = acc.widths[slot.index] ?? slot.min;
      const take = Math.max(0, Math.min(acc.excess, width - slot.min));
      return {
        widths: acc.widths.map((value, index) => (index === slot.index ? value - take : value)),
        excess: acc.excess - take,
      };
    },
    { widths: wanted, excess: sumOf({ values: wanted }) - room },
  ).widths;
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
  return { widths: shrunkOf({ lanes, wanted, room }), room };
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
    return [{ id: first.id, box, tabs: first.tabs ?? [] }];
  }
  const shared = Math.max(0, box.height - SHELL_GUTTER_PX);
  const topHeight = Math.round(shared * lane.split);
  return [
    { id: first.id, box: { ...box, height: topHeight }, tabs: first.tabs ?? [] },
    {
      id: second.id,
      box: { ...box, y: box.y + topHeight + SHELL_GUTTER_PX, height: shared - topHeight },
      tabs: second.tabs ?? [],
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

type FillParams = {
  readonly lanes: ReadonlyArray<Lane>;
  readonly room: number;
  readonly height: number;
};

type LaneHeightParams = {
  readonly lane: Lane;
  readonly height: number;
};

type GrowParams = {
  readonly wanted: ReadonlyArray<number>;
  readonly room: number;
};

const grownOf = ({ wanted, room }: GrowParams): ReadonlyArray<number> => {
  const total = Math.max(1, sumOf({ values: wanted }));
  const scaled = wanted.map((width) => Math.floor((width * room) / total));
  const rest = room - sumOf({ values: scaled });
  return scaled.map((width, index) => (index === scaled.length - 1 ? width + rest : width));
};

const isLaneRowFit = ({ lane, height }: LaneHeightParams): boolean => {
  const [top, bottom] = lane.panes;
  if (top === undefined || bottom === undefined) {
    return true;
  }
  const shared = Math.max(0, height - SHELL_GUTTER_PX);
  const topHeight = Math.round(shared * lane.split);
  return topHeight >= (top.rowMin ?? 0) && shared - topHeight >= (bottom.rowMin ?? 0);
};

const isHeightFit = ({ lanes, height }: Pick<FillParams, 'lanes' | 'height'>): boolean =>
  lanes.every((lane) => isLaneRowFit({ lane, height }));

const deskFillOf = ({ lanes, room, height }: FillParams): ReadonlyArray<number> | null => {
  const space = Math.max(0, room - SHELL_GUTTER_PX * Math.max(0, lanes.length - 1));
  const mins = lanes.map((lane) => DRAWER_TIERS[lane.sizing].min);
  if (sumOf({ values: mins }) > space || !isHeightFit({ lanes, height })) {
    return null;
  }
  const wanted = lanes.map((lane) => wantedWidthOf({ lane }));
  return sumOf({ values: wanted }) > space
    ? shrunkOf({ lanes, wanted, room: space })
    : grownOf({ wanted, room: space });
};

type DeskOrderParams = {
  readonly lanes: ReadonlyArray<Lane>;
  readonly foldOrder: ReadonlyArray<string>;
};

const foldOrderOf = ({ lanes, foldOrder }: DeskOrderParams): ReadonlyArray<string> => {
  const ids = lanes.flatMap((lane) => lane.panes.map((pane) => pane.id));
  const rest = ids.filter((id) => !foldOrder.includes(id)).reverse();
  return [...rest, ...foldOrder.filter((id) => ids.includes(id))];
};

type DeskParams = {
  readonly frame: Frame;
  readonly detail: Lane | null;
  readonly lanes: ReadonlyArray<Lane>;
  readonly foldOrder: ReadonlyArray<string>;
};

type OverDeskParams = {
  readonly frame: Frame;
  readonly detail: Lane | null;
  readonly lanes: ReadonlyArray<Lane>;
};

const deskOverOf = ({ frame, detail, lanes }: OverDeskParams): FrameLayout => {
  const detailWidth =
    detail === null
      ? 0
      : Math.max(
          DRAWER_TIERS[detail.sizing].min,
          Math.min(wantedWidthOf({ lane: detail }), frame.mainWidth),
        );
  const beside =
    detail === null ? frame.mainWidth : frame.mainWidth - detailWidth - SHELL_GUTTER_PX;
  const widths = lanes.map((lane) =>
    Math.max(DRAWER_TIERS[lane.sizing].min, Math.min(wantedWidthOf({ lane }), beside)),
  );
  const used = sumOf({ values: widths }) + SHELL_GUTTER_PX * Math.max(0, widths.length - 1);
  const columns = placedOf({
    frame,
    lanes,
    widths,
    lefts: leftsOf({ start: frame.mainLeft + frame.mainWidth - used, widths }),
    slack: 0,
  });
  const placedDetail =
    detail === null
      ? null
      : (placedOf({
          frame,
          lanes: [detail],
          widths: [detailWidth],
          lefts: [frame.mainLeft],
          slack: 0,
        })[0] ?? null);
  const page = { x: frame.mainLeft, y: frame.top, width: frame.mainWidth, height: frame.height };
  return {
    mode: 'over',
    isStacked: false,
    isDetailOver: false,
    page,
    detail: placedDetail,
    columns,
  };
};

const deskLayoutOf = ({ frame, detail, lanes, foldOrder }: DeskParams): FrameLayout => {
  const states = foldStatesOf({ lanes, order: foldOrderOf({ lanes, foldOrder }) });
  const attempts = states.flatMap((state) => {
    const stacked = foldedOf({ lanes: state });
    return [
      { lanes: state, isStacked: false },
      ...(stacked === null ? [] : [{ lanes: stacked, isStacked: true }]),
    ];
  });
  const fitted = attempts
    .map((attempt) => {
      const placed = detail === null ? attempt.lanes : [detail, ...attempt.lanes];
      return {
        ...attempt,
        placed,
        widths: deskFillOf({ lanes: placed, room: frame.mainWidth, height: frame.height }),
      };
    })
    .find((attempt) => attempt.widths !== null);
  if (fitted === undefined || fitted.widths === null) {
    const last = states[states.length - 1] ?? lanes;
    return deskOverOf({ frame, detail, lanes: last });
  }
  const page = { x: frame.mainLeft, y: frame.top, width: frame.mainWidth, height: frame.height };
  const placed = placedOf({
    frame,
    lanes: fitted.placed,
    widths: fitted.widths,
    lefts: leftsOf({ start: frame.mainLeft, widths: fitted.widths }),
    slack: frame.mainWidth,
  });
  const [placedDetail, ...rest] = placed;
  return {
    mode: 'push',
    isStacked: fitted.isStacked,
    isDetailOver: false,
    page,
    detail: detail === null ? null : (placedDetail ?? null),
    columns: detail === null ? placed : rest,
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
  readonly canPush?: boolean;
  readonly isDesk?: boolean;
  readonly foldOrder?: ReadonlyArray<string>;
};

export const dockLayoutOf = ({
  windowWidth,
  windowHeight,
  top,
  leftRailWidth,
  toolRailWidth,
  detail,
  columns,
  canPush = true,
  isDesk = false,
  foldOrder = [],
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
  if (isDesk) {
    return {
      ...deskLayoutOf({ frame, detail: detailLane, lanes: intent, foldOrder }),
      railForm,
      rail,
    };
  }
  const folded = foldedOf({ lanes: intent });
  const tabbedStates =
    intent.length > 2
      ? foldStatesOf({ lanes: intent, order: foldOrderOf({ lanes: intent, foldOrder }) }).slice(1)
      : [];
  const hasDetail = detailLane !== null;
  const tries: ReadonlyArray<TryParams> = [
    { frame, detail: detailLane, lanes: intent, isStacked: false, isDetailOver: false },
    ...(folded === null
      ? []
      : [{ frame, detail: detailLane, lanes: folded, isStacked: true, isDetailOver: false }]),
    ...tabbedStates.map((lanes) => ({
      frame,
      detail: detailLane,
      lanes,
      isStacked: false,
      isDetailOver: false,
    })),
    ...(hasDetail
      ? [{ frame, detail: detailLane, lanes: intent, isStacked: false, isDetailOver: true }]
      : []),
    ...(hasDetail && folded !== null
      ? [{ frame, detail: detailLane, lanes: folded, isStacked: true, isDetailOver: true }]
      : []),
    ...(hasDetail
      ? tabbedStates.map((lanes) => ({
          frame,
          detail: detailLane,
          lanes,
          isStacked: false,
          isDetailOver: true,
        }))
      : []),
  ];
  const pushed = canPush
    ? tries.reduce<FrameLayout | null>((found, attempt) => found ?? pushLayoutOf(attempt), null)
    : null;
  if (pushed !== null) {
    return { ...pushed, railForm, rail };
  }
  return {
    railForm,
    ...overLayoutOf({
      frame,
      detail: detailLane,
      lanes: folded ?? tabbedStates.at(-1) ?? intent,
      isStacked: folded !== null,
    }),
    rail,
  };
};

type DockSolverParams = {
  readonly isLane: boolean;
};

const ROW_WEIGHT_FRAME = 1000;

const solveDesk = ({
  columnWidth,
  columnHeight,
  foldOrder,
  detail,
  columns,
}: DockSolveParams): SolvedDockFrame =>
  dockLayoutOf({
    windowWidth: columnWidth,
    windowHeight: columnHeight ?? ROW_WEIGHT_FRAME,
    top: 0,
    leftRailWidth: 0,
    toolRailWidth: 0,
    isDesk: true,
    foldOrder,
    detail,
    columns,
  });

const solveDock = ({
  columnWidth,
  railWidth,
  canPush,
  detail,
  columns,
}: DockSolveParams): SolvedDockFrame =>
  dockLayoutOf({
    windowWidth: columnWidth,
    windowHeight: ROW_WEIGHT_FRAME,
    top: 0,
    leftRailWidth: 0,
    toolRailWidth: railWidth,
    canPush,
    detail,
    columns,
  });

export const dockSolverOf = ({
  isLane,
}: DockSolverParams): ((params: DockSolveParams) => SolvedDockFrame) =>
  isLane ? solveDesk : solveDock;
