import { DrawerContentContext } from '../drawerContentContext';
import { useDrawerColumnWidth } from '../useDrawerColumnWidth';
import { useCallback, useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import { dockLayoutOf } from '../dockLayout';
import type { SolvedDockFrame } from '../dockGridFrameOf';
import { DOCK_FOCUS_DETAIL, DOCK_FOCUS_PAGE, type DockGridSpec } from '../dockGridSpec';
import { useDockGrid, type DockSolveParams } from '../useDockGrid';
import { useDrawerTierWidthSet } from '../useDrawerTierWidthSet';
import { DockGrid } from './DockGrid';
import { assignRef } from '../assignRef';
import { cn } from '../cn';
import { columnPairLayoutOf } from '../columnPairLayoutOf';
import { DrawerEdgeContext } from '../drawerEdgeContext';
import { DRAWER_PANEL_VARS } from '../drawerPanelVars';
import { dismissTopEscapeLayer } from '../escape';
import { SHEET_CLASSES, type ResizeActivity, type SheetEdge } from '../sheet';
import { SplitHandle, type SplitHandleProps } from './SplitHandle';
import { DrawerDetailGroup } from './DrawerDetailGroup';
import { DrawerDockBox } from './DrawerDockBox';
import { useDrawerPanel } from '../useDrawerPanel';
import { useDrawerPreview } from '../useDrawerPreview';
import { useEdgeHost } from '../useEdgeHost';
import { useSnapAfterFloat } from '../useSnapAfterFloat';
import { useDrawerTierWidths } from '../useDrawerTierWidths';
import {
  drawerAsideWidthOf,
  panelAsideWidthOf,
  type DrawerMode,
  type DrawerPlacement,
  type DrawerSizing,
} from '../drawerGeometry';

export type DrawerColumnFrame = 'sheet' | 'none';

const SCRIM_RADIUS: Readonly<Record<SheetEdge, string>> = {
  wrapped: 'rounded-l-frame',
  flush: '',
  pushed: 'rounded-frame',
};

type PanelVar = (typeof DRAWER_PANEL_VARS)[keyof typeof DRAWER_PANEL_VARS];

type PanelVars = CSSProperties & Readonly<Record<PanelVar, string>>;

const ROW_WEIGHT_FRAME = 1000;

const DOCK_GRID_KEY = 'dock-grid';

type FocusParams = {
  readonly key: string;
};

const solveDock = ({ columnWidth, railWidth, detail, columns }: DockSolveParams): SolvedDockFrame =>
  dockLayoutOf({
    windowWidth: columnWidth,
    windowHeight: ROW_WEIGHT_FRAME,
    top: 0,
    leftRailWidth: 0,
    toolRailWidth: railWidth,
    detail,
    columns,
  });

export type DrawerColumnProps = {
  readonly main: ReactNode;
  readonly drawer?: ReactNode | null;
  readonly drawerKey?: string;
  readonly dockGrid?: DockGridSpec | null;
  readonly detail?: ReactNode | null;
  readonly detailKey?: string;
  readonly detailSizing?: DrawerSizing;
  readonly isDetailParked?: boolean;
  readonly detailResizeLabel?: string;
  readonly ariaLabel: string;
  readonly resizeLabel: string;
  readonly drawerRef?: Ref<HTMLElement>;
  readonly sizing?: DrawerSizing;
  readonly placement?: DrawerPlacement;
  readonly frame?: DrawerColumnFrame;
  readonly sheetEdge?: Exclude<SheetEdge, 'pushed'>;
  readonly leftResize?: ResizeActivity;
  readonly isParked?: boolean;
  readonly className?: string;
};

export const DrawerColumn = ({
  main,
  drawer,
  drawerKey = 'drawer',
  dockGrid = null,
  detail,
  detailKey = 'detail',
  detailSizing = 'side',
  isDetailParked = false,
  detailResizeLabel = 'Resize detail panel',
  ariaLabel,
  resizeLabel,
  drawerRef,
  sizing = 'side',
  placement = 'auto',
  frame = 'none',
  sheetEdge = 'wrapped',
  leftResize = 'idle',
  isParked = false,
  className,
}: DrawerColumnProps) => {
  const column = useDrawerColumnWidth();
  const edge = useEdgeHost();
  const asideRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const gridCells = dockGrid?.columns.flat() ?? [];
  const isOpen = drawer != null || gridCells.length > 0;
  const isDetailOpen = detail != null;
  const preview = useDrawerPreview({ asideRef, trackRef, groupRef });
  const dockRoute = useRef(preview.previewDock);
  dockRoute.current = preview.previewDock;
  const routeDock = useCallback((next: number) => dockRoute.current(next), []);
  const tiers = useDrawerTierWidthSet({ onPreview: routeDock });
  const resizable = tiers[sizing];
  const detailWidths = useDrawerTierWidths({
    sizing: detailSizing,
    onPreview: preview.previewDetail,
  });
  const railWidth = edge.width;
  const pairLayout = columnPairLayoutOf({
    columnWidth: column.width,
    railWidth,
    placement,
    dock: { sizing, savedWidth: resizable.width, isOpen },
    detail: { sizing: detailSizing, savedWidth: detailWidths.width, isOpen: isDetailOpen },
  });
  const grid = useDockGrid({
    spec: dockGrid,
    columnWidth: column.width,
    railWidth,
    placement,
    detail: {
      isShown: isDetailOpen && !isDetailParked,
      sizing: detailSizing,
      savedWidth: detailWidths.width,
      fallback: pairLayout.detail,
    },
    tiers,
    route: dockRoute,
    previewDock: preview.previewDock,
    solve: solveDock,
    resizeLabel,
  });
  const layout = grid.frame?.pair ?? pairLayout;
  const isFocusShown = grid.cellCount + (isDetailOpen && !isDetailParked ? 1 : 0) > 1;
  const focusKey = dockGrid?.focus ?? null;
  const dockHandle: SplitHandleProps = grid.handles[0] ?? {
    ...resizable.handleProps,
    max: layout.dock.dragMax,
    value: layout.dock.width,
    side: 'right',
    ariaLabel: resizeLabel,
  };
  const focusOn = ({ key }: FocusParams) => dockGrid?.onFocus({ key });
  const singleKey = grid.frame === null ? (gridCells[0]?.key ?? null) : null;
  const mode: DrawerMode = isOpen || isDetailOpen ? layout.mode : 'closed';
  const isOverlay = mode === 'overlay';
  const dockPanel = useDrawerPanel({ isOpen, layoutMode: layout.mode, isParked });
  const detailPanel = useDrawerPanel({
    isOpen: isDetailOpen,
    layoutMode: layout.mode,
    isParked: isDetailParked,
  });
  const isDockShown = isOpen && !isParked;
  const isDetailShown = isDetailOpen && !isDetailParked;
  const isOverlayExit = dockPanel.isOverlayExit || detailPanel.isOverlayExit;
  const isAnyExiting = dockPanel.exit.isExiting || detailPanel.exit.isExiting;
  const isFloating = (isOverlay && (isDockShown || isDetailShown)) || isOverlayExit;
  useSnapAfterFloat({ ref: asideRef, isFloating });
  const dockNode =
    dockGrid !== null && gridCells.length > 0 ? (
      <DockGrid
        gridRef={grid.gridRef}
        spec={dockGrid}
        columns={
          grid.frame?.columns ?? [
            {
              width: layout.dock.width,
              dragMax: layout.dock.dragMax,
              panes: gridCells.map((cell) => ({ key: cell.key, weight: 1 })),
            },
          ]
        }
        handles={grid.handles}
        turn={grid.turn}
        isFramed={grid.frame !== null}
        isFocusShown={isFocusShown}
        isFloating={isFloating}
      />
    ) : (
      drawer
    );
  const hasRail = railWidth > 0;
  const dockPx = isDockShown || (dockPanel.isOverlayExit && !isParked) ? layout.dock.width : 0;
  const detailPx =
    isDetailShown || (detailPanel.isOverlayExit && !isDetailParked) ? layout.detail.width : 0;
  preview.live.current = { mode, rail: railWidth, dock: dockPx, detail: detailPx };
  const asideWidth = panelAsideWidthOf({ dockWidth: dockPx, detailWidth: detailPx, railWidth });
  const asideStyle: PanelVars = {
    width: asideWidth,
    [DRAWER_PANEL_VARS.dock]: `${layout.dock.width}px`,
    [DRAWER_PANEL_VARS.detail]: `${layout.detail.width}px`,
  };
  const setAside = useCallback(
    (node: HTMLElement | null) => {
      asideRef.current = node;
      assignRef({ ref: drawerRef, value: node });
    },
    [drawerRef],
  );

  const isPushed = mode === 'push' && (isDockShown || isDetailShown);
  const isSheet = frame === 'sheet';
  const isBesideRail = hasRail || isPushed;
  const sheetState: SheetEdge = isBesideRail ? 'pushed' : sheetEdge;
  const isContainerIdle = detail !== undefined && !isOpen && !dockPanel.exit.isExiting && !hasRail;
  const isResumed = dockPanel.exit.isResumed || detailPanel.exit.isResumed;

  return (
    <DrawerContentContext.Provider
      value={{ columnWidth: column.width, savedWidth: resizable.width, mode }}
    >
      <div
        ref={column.ref}
        className={cn(
          'relative flex min-h-0 min-w-0 flex-1 overflow-hidden',
          isSheet && isBesideRail && 'pb-3',
          className,
        )}
      >
        <div
          data-container="page"
          data-drawer-main=""
          inert={isOverlay && (isDockShown || isDetailShown)}
          {...(dockGrid !== null && {
            'data-dock-focus': DOCK_FOCUS_PAGE,
            tabIndex: -1,
            onFocusCapture: () => focusOn({ key: DOCK_FOCUS_PAGE }),
            onPointerDownCapture: () => focusOn({ key: DOCK_FOCUS_PAGE }),
          })}
          {...(isSheet && { 'data-sheet': sheetState, 'data-left-resize': leftResize })}
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col focus-visible:outline-none',
            isSheet && 'overflow-hidden bg-background',
            isSheet && SHEET_CLASSES[sheetState],
          )}
        >
          <DrawerEdgeContext.Provider value={edge.host}>{main}</DrawerEdgeContext.Provider>
        </div>
        {isFloating ? (
          <div
            aria-hidden
            data-drawer-scrim=""
            onMouseDown={isAnyExiting ? undefined : (event) => event.preventDefault()}
            onClick={isAnyExiting ? undefined : () => dismissTopEscapeLayer()}
            className={cn(
              'absolute inset-0 z-10 bg-scrim',
              isSheet && SCRIM_RADIUS[sheetState],
              isOverlayExit && !isOverlay && 'pointer-events-none animate-drawer-fade-out',
              !isOverlayExit && !isResumed && 'motion-safe:animate-fade-in',
            )}
          />
        ) : null}
        {isFloating ? (
          <div
            aria-hidden
            data-drawer-spacer=""
            style={{ width: drawerAsideWidthOf({ width: 0, mode: 'closed', railWidth }) }}
            className="shrink-0"
          />
        ) : null}
        <aside
          ref={setAside}
          aria-label={ariaLabel}
          data-drawer-mode={isDockShown || isDetailShown ? mode : 'closed'}
          data-drawer-parked={isParked || (isDetailParked && isDetailOpen) ? '' : undefined}
          data-drawer-exit={isAnyExiting ? '' : undefined}
          data-drawer-sizing={sizing}
          data-detail-open={isDetailShown ? '' : undefined}
          style={asideStyle}
          className={cn(
            'flex min-h-0 shrink-0 justify-end',
            isFloating
              ? cn(
                  'pointer-events-none absolute bottom-0 right-0 z-20',
                  isSheet ? 'top-px' : 'top-0',
                )
              : 'relative overflow-clip motion-safe:transition-[width]',
            'duration-200 ease-enter',
          )}
        >
          <div
            className={cn('flex min-h-0 min-w-0 flex-1', !isFloating && !isSheet && 'py-3')}
            ref={trackRef}
            style={{ minWidth: isFloating ? asideWidth : 0 }}
          >
            {detail !== undefined ? (
              <DrawerDetailGroup
                groupRef={groupRef}
                panel={detailPanel}
                node={detail}
                panelKey={detailKey}
                shownWidth={detailPx}
                width={layout.detail.width}
                dragMax={layout.detail.dragMax}
                handleProps={detailWidths.handleProps}
                resizeLabel={detailResizeLabel}
                isOpen={isDetailOpen}
                isParked={isDetailParked}
                isOverlay={isOverlay}
                isFloating={isFloating}
                mode={mode}
                columnWidth={column.width}
                savedWidth={detailWidths.width}
                isFocused={isFocusShown && focusKey === DOCK_FOCUS_DETAIL}
                onFocus={dockGrid === null ? null : () => focusOn({ key: DOCK_FOCUS_DETAIL })}
              />
            ) : null}
            <div
              className={cn(
                'flex w-3 shrink-0 justify-center',
                isOverlay && 'pointer-events-auto',
                isContainerIdle && 'hidden',
              )}
            >
              {isDockShown ? <SplitHandle {...dockHandle} /> : null}
            </div>
            <DrawerDockBox
              panel={dockPanel}
              node={dockNode}
              panelKey={dockGrid === null ? drawerKey : DOCK_GRID_KEY}
              isOpen={isOpen}
              isParked={isParked}
              isOverlay={isOverlay}
              isFloating={isFloating}
              isIdle={isContainerIdle}
              parkedWidth={layout.dock.width}
              setEdgeHost={edge.setHost}
              isGrid={grid.frame !== null}
              isFocused={isFocusShown && singleKey !== null && focusKey === singleKey}
            />
          </div>
        </aside>
      </div>
    </DrawerContentContext.Provider>
  );
};
