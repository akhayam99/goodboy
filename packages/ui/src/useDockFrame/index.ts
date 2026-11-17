import { useCallback, useRef } from 'react';
import { columnPairLayoutOf } from '../columnPairLayoutOf';
import type { SolvedDockFrame } from '../dockGridFrameOf';
import { DOCK_FOCUS_DETAIL, type DockGridCell, type DockGridSpec } from '../dockGridSpec';
import type { DrawerPlacement, DrawerSizing, PanelPairLayout } from '../drawerGeometry';
import type { SplitHandleProps } from '../components/SplitHandle';
import { useDockGrid, type DockSolveParams } from '../useDockGrid';
import { useDrawerTierWidths } from '../useDrawerTierWidths';
import { useDrawerTierWidthSet } from '../useDrawerTierWidthSet';
import type { ResizableWidth } from '../useResizableWidth';

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
  readonly previewDock: Preview;
  readonly previewDetail: Preview;
  readonly solve: (params: DockSolveParams) => SolvedDockFrame;
  readonly resizeLabel: string;
};

type DockFrame = {
  readonly cells: ReadonlyArray<DockGridCell>;
  readonly isOpen: boolean;
  readonly resizable: ResizableWidth<HTMLElement>;
  readonly detailWidths: ResizableWidth<HTMLElement>;
  readonly layout: PanelPairLayout;
  readonly grid: ReturnType<typeof useDockGrid>;
  readonly dockHandle: SplitHandleProps;
  readonly isFocusShown: boolean;
  readonly isSingleFocused: boolean;
  readonly gridKey: string;
  readonly detailFocus: {
    readonly isFocused: boolean;
    readonly onFocus: (() => void) | null;
  };
};

const DOCK_GRID_KEY = 'dock-grid';

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
  const resizable = tiers[sizing];
  const detailWidths = useDrawerTierWidths({ sizing: detailSizing, onPreview: previewDetail });
  const pairLayout = columnPairLayoutOf({
    columnWidth,
    railWidth,
    placement,
    dock: { sizing, savedWidth: resizable.width, isOpen },
    detail: { sizing: detailSizing, savedWidth: detailWidths.width, isOpen: isDetailOpen },
  });
  const isDetailShown = isDetailOpen && !isDetailParked;
  const grid = useDockGrid({
    spec: dockGrid,
    columnWidth,
    railWidth,
    placement,
    detail: {
      isShown: isDetailShown,
      sizing: detailSizing,
      savedWidth: detailWidths.width,
      fallback: pairLayout.detail,
    },
    tiers,
    route: dockRoute,
    previewDock,
    solve,
    resizeLabel,
  });
  const layout = grid.frame?.pair ?? pairLayout;
  const isFocusShown = grid.cellCount + (isDetailShown ? 1 : 0) > 1;
  const focusKey = dockGrid?.focus ?? null;
  const singleKey = grid.frame === null ? (cells[0]?.key ?? null) : null;
  return {
    cells,
    isOpen,
    resizable,
    detailWidths,
    layout,
    grid,
    dockHandle: grid.handles[0] ?? {
      ...resizable.handleProps,
      max: layout.dock.dragMax,
      value: layout.dock.width,
      side: 'right',
      ariaLabel: resizeLabel,
    },
    isFocusShown,
    isSingleFocused: isFocusShown && singleKey !== null && focusKey === singleKey,
    gridKey: DOCK_GRID_KEY,
    detailFocus: {
      isFocused: isFocusShown && focusKey === DOCK_FOCUS_DETAIL,
      onFocus: dockGrid === null ? null : () => dockGrid.onFocus({ key: DOCK_FOCUS_DETAIL }),
    },
  };
};
