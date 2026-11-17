import { DrawerContentContext } from '../drawerContentContext';
import { useDrawerColumnWidth } from '../useDrawerColumnWidth';
import { useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import { dockLayoutOf } from '../dockLayout';
import type { SolvedDockFrame } from '../dockGridFrameOf';
import type { DockGridSpec } from '../dockGridSpec';
import type { DockSolveParams } from '../useDockGrid';
import { useDockFrame } from '../useDockFrame';
import { pageFocusPropsOf } from '../pageFocusPropsOf';
import { DrawerDockNode } from './DrawerDockNode';
import { DrawerScrim } from './DrawerScrim';
import { useAsideRef } from '../useAsideRef';
import { cn } from '../cn';
import { DrawerEdgeContext } from '../drawerEdgeContext';
import { DRAWER_PANEL_VARS } from '../drawerPanelVars';
import { SHEET_CLASSES, type ResizeActivity, type SheetEdge } from '../sheet';
import { SplitHandle } from './SplitHandle';
import { DrawerDetailGroup } from './DrawerDetailGroup';
import { DrawerDockBox } from './DrawerDockBox';
import { useDrawerPanel } from '../useDrawerPanel';
import { useDrawerPreview } from '../useDrawerPreview';
import { useEdgeHost } from '../useEdgeHost';
import { useSnapAfterFloat } from '../useSnapAfterFloat';
import {
  panelAsideWidthOf,
  type DrawerMode,
  type DrawerPlacement,
  type DrawerSizing,
} from '../drawerGeometry';

export type DrawerColumnFrame = 'sheet' | 'none';

type PanelVar = (typeof DRAWER_PANEL_VARS)[keyof typeof DRAWER_PANEL_VARS];

type PanelVars = CSSProperties & Readonly<Record<PanelVar, string>>;

const ROW_WEIGHT_FRAME = 1000;

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
    previewDock: preview.previewDock,
    previewDetail: preview.previewDetail,
    solve: solveDock,
    resizeLabel,
  });
  const { isOpen, resizable, detailWidths, layout } = dock;
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
          {...pageFocusPropsOf({ dockGrid })}
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
          <DrawerScrim
            isSheet={isSheet}
            sheetState={sheetState}
            isAnyExiting={isAnyExiting}
            isOverlay={isOverlay}
            isOverlayExit={isOverlayExit}
            isResumed={isResumed}
            railWidth={railWidth}
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
              {isDockShown ? <SplitHandle {...dock.dockHandle} /> : null}
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
              isGrid={dock.grid.frame !== null}
              isFocused={dock.isSingleFocused}
            />
          </div>
        </aside>
      </div>
    </DrawerContentContext.Provider>
  );
};
