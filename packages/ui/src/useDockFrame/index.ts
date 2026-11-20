import { useCallback, useRef } from 'react';
import type { SolvedDockFrame } from '../dockGridFrameOf';
import { DOCK_FOCUS_DETAIL, type DockGridCell, type DockGridSpec } from '../dockGridSpec';
import type { DrawerPlacement, DrawerSizing, PanelPairLayout } from '../drawerGeometry';
import type { SplitHandleProps } from '../components/SplitHandle';
import { useDetailWidth } from '../useDetailWidth';
import { useDockGrid, type DockSolveParams } from '../useDockGrid';
import { useDrawerTierWidthSet } from '../useDrawerTierWidthSet';
import type { ResizableHandleProps } from '../useResizableWidth';

type Preview = (width: number) => void;

type Params = {
  readonly dockGrid: DockGridSpec | null;
  readonly hasDrawer: boolean;
  readonly isDetailOpen: boolean;
  readonly isDetailParked: boolean;
  readonly columnWidth: number | null;
  readonly railWidth: number;
  readonly placement: DrawerPlacement;
  readonly sizing: DrawerSizing;
  readonly detailSizing: DrawerSizing;
  readonly detailKind: string | null;
  readonly previewDock: Preview;
  readonly previewDetail: Preview;
  readonly solve: (params: DockSolveParams) => SolvedDockFrame;
  readonly resizeLabel: string;
};

type DockFrame = {
  readonly cells: ReadonlyArray<DockGridCell>;
  readonly isOpen: boolean;
  readonly savedWidth: number;
  readonly detailWidths: {
    readonly width: number;
    readonly handleProps: ResizableHandleProps;
  };
  readonly layout: PanelPairLayout;
  readonly grid: ReturnType<typeof useDockGrid>;
  readonly dockHandle: SplitHandleProps | null;
  readonly isFocusShown: boolean;
  readonly isSingleFocused: boolean;
  readonly gridKey: string;
  readonly detailFocus: {
    readonly isFocused: boolean;
    readonly onFocus: (() => void) | null;
  };
};

const DOCK_GRID_KEY = 'dock-grid';

const LONE_DOCK_KEY = 'dock';

export const useDockFrame = ({
  dockGrid,
  hasDrawer,
  isDetailOpen,
  isDetailParked,
  columnWidth,
  railWidth,
  placement,
  sizing,
  detailSizing,
  detailKind,
  previewDock,
  previewDetail,
  solve,
  resizeLabel,
}: Params): DockFrame => {
  const cells = dockGrid?.columns.flat() ?? [];
  const isOpen = hasDrawer || cells.length > 0;
  const dockRoute = useRef(previewDock);
  dockRoute.current = previewDock;
  const routeDock = useCallback((next: number) => dockRoute.current(next), []);
  const tiers = useDrawerTierWidthSet({ onPreview: routeDock });
  const detailWidths = useDetailWidth({
    kind: detailKind,
    sizing: detailSizing,
    onPreview: previewDetail,
  });
  const isLone = cells.length === 0;
  const loneCell: DockGridCell = { key: LONE_DOCK_KEY, sizing, savedWidth: tiers[sizing].width };
  const columns = isLone ? (hasDrawer ? [[loneCell]] : []) : (dockGrid?.columns ?? []);
  const isDetailShown = isDetailOpen && !isDetailParked;
  const grid = useDockGrid({
    columns,
    cellCount: cells.length,
    onResize: isLone ? undefined : dockGrid?.onResize,
    columnWidth,
    railWidth,
    placement,
    detail: { isShown: isDetailShown, sizing: detailSizing, savedWidth: detailWidths.width },
    tiers,
    route: dockRoute,
    previewDock,
    solve,
    resizeLabel,
  });
  const layout = grid.frame.pair;
  const isFocusShown = grid.cellCount + (isDetailShown ? 1 : 0) > 1;
  const focusKey = dockGrid?.focus ?? null;
  const singleKey = grid.isGrid ? null : (cells[0]?.key ?? null);
  const single = cells.length === 1 ? (cells[0] ?? null) : null;
  return {
    cells,
    isOpen,
    savedWidth: single?.savedWidth ?? tiers[single?.sizing ?? sizing].width,
    detailWidths,
    layout,
    grid,
    dockHandle: grid.handles[0] ?? null,
    isFocusShown,
    isSingleFocused: isFocusShown && singleKey !== null && focusKey === singleKey,
    gridKey: DOCK_GRID_KEY,
    detailFocus: {
      isFocused: isFocusShown && focusKey === DOCK_FOCUS_DETAIL,
      onFocus: dockGrid === null ? null : () => dockGrid.onFocus({ key: DOCK_FOCUS_DETAIL }),
    },
  };
};
