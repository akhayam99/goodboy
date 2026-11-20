import { DrawerContentContext } from '../drawerContentContext';
import { useDrawerColumnWidth } from '../useDrawerColumnWidth';
import { useRef } from 'react';
import { dockLayoutOf } from '../dockLayout';
import type { SolvedDockFrame } from '../dockGridFrameOf';
import type { DockSolveParams } from '../useDockGrid';
import { useDockFrame } from '../useDockFrame';
import { pageFocusPropsOf } from '../pageFocusPropsOf';
import { DrawerDockNode } from './DrawerDockNode';
import { useAsideRef } from '../useAsideRef';
import { cn } from '../cn';
import { DrawerEdgeContext } from '../drawerEdgeContext';
import { DRAWER_PANEL_VARS, type PanelVars } from '../drawerPanelVars';
import { SHEET_CLASSES, type SheetEdge } from '../sheet';
import { DrawerSpacer } from './DrawerSpacer';
import type { DrawerColumnProps } from './drawerColumnProps';
import { SplitHandle } from './SplitHandle';
import { DrawerDetailGroup } from './DrawerDetailGroup';
import { DrawerDockBox } from './DrawerDockBox';
import { useDrawerPanel } from '../useDrawerPanel';
import { useDrawerPreview } from '../useDrawerPreview';
import { useEdgeHost } from '../useEdgeHost';
import { useSnapAfterFloat } from '../useSnapAfterFloat';
import { panelAsideWidthOf, type DrawerMode } from '../drawerGeometry';

const ROW_WEIGHT_FRAME = 1000;

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

export const DrawerColumn = ({
  main,
  drawer,
  drawerKey = 'drawer',
  dockGrid = null,
  detail,
  detailKey = 'detail',
  detailKind = null,
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
  isParked = false,
  className,
}: DrawerColumnProps) => {
  const column = useDrawerColumnWidth();
  const edge = useEdgeHost();
  const { asideRef, setAside } = useAsideRef({ drawerRef });
  const trackRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const isDetailOpen = detail != null;
  const preview = useDrawerPreview({ asideRef, trackRef, groupRef });
  const railWidth = edge.width;
  const dock = useDockFrame({
    dockGrid,
    hasDrawer: drawer != null,
    isDetailOpen,
    isDetailParked,
    columnWidth: column.width,
    railWidth,
    placement,
    sizing,
    detailSizing,
    detailKind,
    previewDock: preview.previewDock,
    previewDetail: preview.previewDetail,
    solve: solveDock,
    resizeLabel,
  });
  const { isOpen, detailWidths, layout } = dock;
  const mode: DrawerMode = isOpen || isDetailOpen ? layout.mode : 'closed';
  const isOverlay = mode === 'overlay';
  const isDetailOver = layout.isDetailOver && !isOverlay;
  const dockPanel = useDrawerPanel({ isOpen, layoutMode: layout.mode, isParked });
  const detailPanel = useDrawerPanel({
    isOpen: isDetailOpen,
    layoutMode: isDetailOver ? 'overlay' : layout.mode,
    isParked: isDetailParked,
  });
  const isDockShown = isOpen && !isParked;
  const isDetailShown = isDetailOpen && !isDetailParked;
  const isDockOverlayExit = dockPanel.isOverlayExit && !isDetailOver;
  const isOverlayExit = isDockOverlayExit || (detailPanel.isOverlayExit && !isDetailOver);
  const isAnyExiting = dockPanel.exit.isExiting || detailPanel.exit.isExiting;
  const isFloating = (isOverlay && (isDockShown || isDetailShown)) || isOverlayExit;
  const isDetailFloating = isFloating || isDetailOver;
  useSnapAfterFloat({ ref: asideRef, isFloating });
  const hasRail = railWidth > 0;
  const dockPx = isDockShown || (dockPanel.isOverlayExit && !isParked) ? layout.dock.width : 0;
  const detailPx =
    isDetailShown || (detailPanel.isOverlayExit && !isDetailParked) ? layout.detail.width : 0;
  const pushedDetailPx = isDetailOver ? 0 : detailPx;
  preview.live.current = {
    mode,
    rail: railWidth,
    dock: dockPx,
    detail: pushedDetailPx,
    isDetailOver,
  };
  const asideWidth = panelAsideWidthOf({
    dockWidth: dockPx,
    detailWidth: pushedDetailPx,
    railWidth,
  });
  const asideStyle: PanelVars = {
    width: asideWidth,
    [DRAWER_PANEL_VARS.dock]: `${layout.dock.width}px`,
    [DRAWER_PANEL_VARS.detail]: `${layout.detail.width}px`,
  };

  const isPushed = mode === 'push' && (isDockShown || isDetailShown);
  const isSheet = frame === 'sheet';
  const isBesideRail = hasRail || isPushed;
  const sheetState: SheetEdge = isBesideRail ? 'pushed' : sheetEdge;
  const isContainerIdle = detail !== undefined && !isOpen && !dockPanel.exit.isExiting && !hasRail;

  return (
    <DrawerContentContext.Provider
      value={{ columnWidth: column.width, savedWidth: dock.savedWidth, mode }}
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
          {...pageFocusPropsOf({ dockGrid })}
          {...(isSheet && { 'data-sheet': sheetState })}
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col focus-visible:outline-none',
            isSheet && 'overflow-hidden bg-background',
            isSheet && SHEET_CLASSES[sheetState],
          )}
        >
          <DrawerEdgeContext.Provider value={edge.host}>{main}</DrawerEdgeContext.Provider>
        </div>
        {isFloating ? <DrawerSpacer railWidth={railWidth} /> : null}
        <aside
          ref={setAside}
          aria-label={ariaLabel}
          data-drawer-mode={isDockShown || isDetailShown ? mode : 'closed'}
          data-detail-over={isDetailOver && isDetailShown ? '' : undefined}
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
              : cn(
                  'relative motion-safe:transition-[width]',
                  isDetailOver ? 'overflow-visible' : 'overflow-clip',
                ),
            'duration-200 ease-enter',
          )}
        >
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1',
              !isFloating && !isSheet && 'py-3',
              isDetailOver && 'relative',
            )}
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
                isOverlay={isOverlay || isDetailOver}
                isFloating={isDetailFloating}
                isOverPage={isDetailOver}
                isInset={!isSheet}
                mode={isDetailOver ? 'overlay' : mode}
                columnWidth={column.width}
                savedWidth={detailWidths.width}
                {...dock.detailFocus}
              />
            ) : null}
            <div
              className={cn(
                'flex w-3 shrink-0 justify-center',
                isOverlay && 'pointer-events-auto',
                isContainerIdle && 'hidden',
              )}
            >
              {isDockShown && dock.dockHandle !== null ? (
                <SplitHandle {...dock.dockHandle} />
              ) : null}
            </div>
            <DrawerDockBox
              panel={dockPanel}
              node={
                <DrawerDockNode
                  dockGrid={dockGrid}
                  frame={dock}
                  drawer={drawer}
                  isFloating={isFloating}
                />
              }
              panelKey={dockGrid === null ? drawerKey : dock.gridKey}
              isOpen={isOpen}
              isParked={isParked}
              isOverlay={isOverlay}
              isFloating={isFloating}
              isIdle={isContainerIdle}
              parkedWidth={layout.dock.width}
              setEdgeHost={edge.setHost}
              isGrid={dock.grid.isGrid}
              isFocused={dock.isSingleFocused}
            />
          </div>
        </aside>
      </div>
    </DrawerContentContext.Provider>
  );
};
