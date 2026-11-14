import { DrawerContentContext } from '../drawerContentContext';
import { useDrawerColumnWidth } from '../useDrawerColumnWidth';
import { useCallback, useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import { cn } from '../cn';
import { DrawerEdgeContext } from '../drawerEdgeContext';
import { dismissTopEscapeLayer } from '../escape';
import { SHEET_CLASSES, type ResizeActivity, type SheetEdge } from '../sheet';
import { ResizeHandle } from './ResizeHandle';
import { DrawerPanelCard } from './DrawerPanelCard';
import { useDrawerPanel } from '../useDrawerPanel';
import { useEdgeHost } from '../useEdgeHost';
import { useDrawerTierWidths } from '../useDrawerTierWidths';
import {
  DRAWER_INSET,
  panelAsideWidthOf,
  panelPairLayoutOf,
  type DrawerMode,
  type DrawerPlacement,
  type DrawerSizing,
} from '../drawerGeometry';
import { unmeasuredLayoutOf } from '../unmeasuredLayoutOf';

export type DrawerColumnFrame = 'sheet' | 'none';

const PANEL_VAR = '--goodboy-drawer-panel';

const DETAIL_VAR = '--goodboy-detail-panel';

const PUSH_CONTENT = 'w-[calc(var(--goodboy-drawer-panel)-1px)]';

const DETAIL_CONTENT = 'w-[calc(var(--goodboy-detail-panel)-2px)]';

const SLIDE = 'motion-safe:transition-[width] duration-200 ease-enter';

const SCRIM_RADIUS: Readonly<Record<SheetEdge, string>> = {
  wrapped: 'rounded-l-frame',
  flush: '',
  pushed: 'rounded-frame',
};

type LiveWidths = {
  readonly mode: DrawerMode;
  readonly rail: number;
  readonly dock: number;
  readonly detail: number;
};

type PanelVars = CSSProperties & Readonly<Record<typeof PANEL_VAR | typeof DETAIL_VAR, string>>;

export type DrawerColumnProps = {
  readonly main: ReactNode;
  readonly drawer?: ReactNode | null;
  readonly drawerKey?: string;
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
  const isOpen = drawer != null;
  const isDetailOpen = detail != null;
  const hasDetailGroup = detail !== undefined;
  const live = useRef<LiveWidths>({ mode: 'closed', rail: 0, dock: 0, detail: 0 });
  const previewAside = useCallback(() => {
    const { mode, rail, dock, detail: detailPx } = live.current;
    const track = `${panelAsideWidthOf({ dockWidth: dock, detailWidth: detailPx, railWidth: rail })}px`;
    asideRef.current?.style.setProperty('width', track);
    if (mode === 'overlay') {
      trackRef.current?.style.setProperty('min-width', track);
    }
  }, []);
  const previewDock = useCallback(
    (next: number) => {
      live.current = { ...live.current, dock: live.current.dock > 0 ? next : 0 };
      asideRef.current?.style.setProperty(PANEL_VAR, `${next}px`);
      previewAside();
    },
    [previewAside],
  );
  const previewDetail = useCallback(
    (next: number) => {
      live.current = { ...live.current, detail: next };
      asideRef.current?.style.setProperty(DETAIL_VAR, `${next}px`);
      groupRef.current?.style.setProperty('width', `${next + DRAWER_INSET}px`);
      previewAside();
    },
    [previewAside],
  );
  const resizable = useDrawerTierWidths({ sizing, onPreview: previewDock });
  const detailWidths = useDrawerTierWidths({ sizing: detailSizing, onPreview: previewDetail });
  const railWidth = edge.width;
  const dockSpec = { sizing, savedWidth: resizable.width, isOpen };
  const detailSpec = { sizing: detailSizing, savedWidth: detailWidths.width, isOpen: isDetailOpen };
  const lead = isDetailOpen && !isOpen ? detailSpec : dockSpec;
  const unmeasured = unmeasuredLayoutOf({
    savedWidth: lead.savedWidth,
    sizing: lead.sizing,
    placement,
  });
  const layout =
    column.width === null
      ? {
          mode: unmeasured.mode,
          dock: unmeasuredLayoutOf({ savedWidth: resizable.width, sizing, placement }),
          detail: unmeasuredLayoutOf({
            savedWidth: detailWidths.width,
            sizing: detailSizing,
            placement,
          }),
        }
      : panelPairLayoutOf({
          main: column.width,
          contentInset: railWidth,
          edgeWidth: railWidth,
          placement,
          dock: dockSpec,
          detail: detailSpec,
        });
  const isAnyOpen = isOpen || isDetailOpen;
  const mode: DrawerMode = isAnyOpen ? layout.mode : 'closed';
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
  const isOverlayShown = (isOverlay && (isDockShown || isDetailShown)) || isOverlayExit;
  const isFloating = isOverlayShown;
  const hasRail = railWidth > 0;
  const dockPx = isDockShown || (dockPanel.isOverlayExit && !isParked) ? layout.dock.width : 0;
  const detailPx =
    isDetailShown || (detailPanel.isOverlayExit && !isDetailParked) ? layout.detail.width : 0;
  live.current = { mode, rail: railWidth, dock: dockPx, detail: detailPx };
  const asideWidth = panelAsideWidthOf({ dockWidth: dockPx, detailWidth: detailPx, railWidth });
  const spacerWidth = panelAsideWidthOf({ dockWidth: 0, detailWidth: 0, railWidth });
  const asideStyle: PanelVars = {
    width: asideWidth,
    [PANEL_VAR]: `${layout.dock.width}px`,
    [DETAIL_VAR]: `${layout.detail.width}px`,
  };
  const setAside = useCallback(
    (node: HTMLElement | null) => {
      asideRef.current = node;
      if (typeof drawerRef === 'function') {
        drawerRef(node);
        return;
      }
      if (drawerRef != null) {
        drawerRef.current = node;
      }
    },
    [drawerRef],
  );

  const isPushed = mode === 'push' && (isDockShown || isDetailShown);
  const isSheet = frame === 'sheet';
  const isBesideRail = hasRail || isPushed;
  const sheetState: SheetEdge = isBesideRail ? 'pushed' : sheetEdge;
  const isContainerIdle = hasDetailGroup && !isOpen && !dockPanel.exit.isExiting && !hasRail;
  const dockContent = { columnWidth: column.width, savedWidth: resizable.width, mode };
  const detailContent = { columnWidth: column.width, savedWidth: detailWidths.width, mode };

  return (
    <DrawerContentContext.Provider value={dockContent}>
      <div
        ref={column.ref}
        className={cn(
          'relative flex min-h-0 min-w-0 flex-1 overflow-hidden',
          isSheet && isBesideRail && 'pb-2',
          className,
        )}
      >
        <div
          data-container="page"
          data-drawer-main=""
          inert={isOverlay && (isDockShown || isDetailShown)}
          {...(isSheet && { 'data-sheet': sheetState, 'data-left-resize': leftResize })}
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            isSheet && 'overflow-hidden bg-background',
            isSheet && SHEET_CLASSES[sheetState],
          )}
        >
          <DrawerEdgeContext.Provider value={edge.host}>{main}</DrawerEdgeContext.Provider>
        </div>
        {isOverlayShown ? (
          <div
            aria-hidden
            data-drawer-scrim=""
            onMouseDown={isAnyExiting ? undefined : (event) => event.preventDefault()}
            onClick={isAnyExiting ? undefined : () => dismissTopEscapeLayer()}
            className={cn(
              'absolute inset-0 z-10 bg-scrim',
              isSheet && SCRIM_RADIUS[sheetState],
              isOverlayExit && !isOverlay && 'pointer-events-none animate-drawer-fade-out',
              !isOverlayExit &&
                !dockPanel.exit.isResumed &&
                !detailPanel.exit.isResumed &&
                'motion-safe:animate-fade-in',
            )}
          />
        ) : null}
        {isFloating ? (
          <div
            aria-hidden
            data-drawer-spacer=""
            style={{ width: spacerWidth }}
            className="shrink-0"
          />
        ) : null}
        <aside
          ref={setAside}
          aria-label={ariaLabel}
          data-drawer-mode={isParked && !isDetailShown ? 'closed' : mode}
          data-drawer-parked={isParked ? '' : undefined}
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
            className={cn('flex min-h-0 min-w-0 flex-1', !isFloating && !isSheet && 'py-2')}
            ref={trackRef}
            style={{ minWidth: isFloating ? asideWidth : 0 }}
          >
            {hasDetailGroup ? (
              <div
                ref={groupRef}
                data-detail-group=""
                style={{ width: detailPx > 0 ? detailPx + DRAWER_INSET : 0 }}
                className={cn('flex min-h-0 shrink-0 overflow-clip', !isFloating && SLIDE)}
              >
                <div
                  className={cn(
                    'flex w-2 shrink-0 justify-center',
                    isOverlay && 'pointer-events-auto',
                  )}
                >
                  {isDetailShown ? (
                    <ResizeHandle
                      {...detailWidths.handleProps}
                      max={layout.detail.dragMax}
                      value={layout.detail.width}
                      side="right"
                      ariaLabel={detailResizeLabel}
                    />
                  ) : null}
                </div>
                <div
                  data-container="detail"
                  className={cn(
                    'panel-on-page relative flex min-h-0 min-w-0 flex-1 overflow-clip rounded-frame border border-frame-edge bg-background',
                    isFloating && 'pointer-events-auto shadow-xl',
                  )}
                >
                  {isDetailOpen || detailPanel.exit.isExiting ? (
                    <DrawerContentContext.Provider value={detailContent}>
                      <DrawerPanelCard
                        slot="detail"
                        panel={detailPanel}
                        node={detail}
                        panelKey={detailKey}
                        isOpen={isDetailOpen}
                        isParked={isDetailParked}
                        isOverlay={isOverlay}
                        isFloating={isFloating}
                        parkedWidth={layout.detail.width}
                        pushWidthClass={DETAIL_CONTENT}
                      />
                    </DrawerContentContext.Provider>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div
              className={cn(
                'flex w-2 shrink-0 justify-center',
                isOverlay && 'pointer-events-auto',
                isContainerIdle && 'hidden',
              )}
            >
              {isDockShown ? (
                <ResizeHandle
                  {...resizable.handleProps}
                  max={layout.dock.dragMax}
                  value={layout.dock.width}
                  side="right"
                  ariaLabel={resizeLabel}
                />
              ) : null}
            </div>
            <div
              data-container="drawer"
              className={cn(
                'panel-on-rail relative flex min-h-0 min-w-0 flex-1 overflow-clip rounded-l-frame border-y border-l border-frame-edge bg-drawer',
                isFloating && 'pointer-events-auto shadow-xl',
                isContainerIdle && 'border-0',
              )}
            >
              {isOpen || dockPanel.exit.isExiting ? (
                <DrawerPanelCard
                  slot="drawer"
                  panel={dockPanel}
                  node={drawer}
                  panelKey={drawerKey}
                  isOpen={isOpen}
                  isParked={isParked}
                  isOverlay={isOverlay}
                  isFloating={isFloating}
                  parkedWidth={layout.dock.width}
                  pushWidthClass={PUSH_CONTENT}
                />
              ) : null}
              <div
                ref={edge.setHost}
                data-drawer-edge=""
                className="relative z-10 flex shrink-0 bg-drawer empty:hidden"
              />
            </div>
          </div>
        </aside>
      </div>
    </DrawerContentContext.Provider>
  );
};
