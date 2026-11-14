import { DrawerContentContext } from '../drawerContentContext';
import { useDrawerColumnWidth } from '../useDrawerColumnWidth';
import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from '../cn';
import { DrawerEdgeContext } from '../drawerEdgeContext';
import { DrawerParkedContext } from '../drawerParkedContext';
import { dismissTopEscapeLayer } from '../escape';
import { SHEET_CLASSES, type ResizeActivity, type SheetEdge } from '../sheet';
import { ResizeHandle } from './ResizeHandle';
import { useDrawerExit } from '../useDrawerExit';
import { useEdgeHost } from '../useEdgeHost';
import { mountExitSnapshot } from '../exitSnapshot';
import { useDrawerTierWidths } from '../useDrawerTierWidths';
import {
  drawerAsideWidthOf,
  drawerLayoutOf,
  type DrawerMode,
  type DrawerPlacement,
  type DrawerSizing,
} from '../drawerGeometry';
import { unmeasuredLayoutOf } from '../unmeasuredLayoutOf';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

export type DrawerColumnFrame = 'sheet' | 'none';

const PANEL_VAR = '--goodboy-drawer-panel';

const PUSH_CONTENT = 'w-[calc(var(--goodboy-drawer-panel)-1px)]';

const SCRIM_RADIUS: Readonly<Record<SheetEdge, string>> = {
  wrapped: 'rounded-l-frame',
  flush: '',
  pushed: 'rounded-frame',
};

export type DrawerColumnProps = {
  readonly main: ReactNode;
  readonly drawer?: ReactNode | null;
  readonly drawerKey?: string;
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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const isOpen = drawer != null;
  const modeRef = useRef<DrawerMode>('closed');
  const railRef = useRef(0);
  railRef.current = edge.width;
  const onPreview = (next: number) => {
    const track = `${drawerAsideWidthOf({ width: next, mode: modeRef.current, railWidth: railRef.current })}px`;
    asideRef.current?.style.setProperty('width', track);
    asideRef.current?.style.setProperty(PANEL_VAR, `${next}px`);
    if (modeRef.current === 'overlay') {
      trackRef.current?.style.setProperty('min-width', track);
    }
  };
  const resizable = useDrawerTierWidths({ sizing, onPreview });
  const railWidth = edge.width;
  const layout =
    column.width === null
      ? unmeasuredLayoutOf({ savedWidth: resizable.width, sizing, placement })
      : drawerLayoutOf({
          main: column.width,
          contentInset: railWidth,
          sizing,
          savedWidth: resizable.width,
          placement,
          edgeWidth: railWidth,
        });
  const mode: DrawerMode = isOpen ? layout.mode : 'closed';
  modeRef.current = mode;
  const isOverlay = mode === 'overlay';
  const isOverlayOpen = isOpen && isOverlay;
  const exit = useDrawerExit({ isOpen, layoutMode: layout.mode, cardRef, contentRef });
  const isExiting = exit.isExiting;
  const isOverlayExit = isExiting && exit.lastMode === 'overlay';
  const isPushExit = isExiting && exit.lastMode === 'push';
  const isFloating = !isParked && (isOverlay || isOverlayExit);
  const hasRail = railWidth > 0;
  const asideMode: DrawerMode = isParked ? 'closed' : isOverlayExit ? 'overlay' : mode;
  const asideWidth = drawerAsideWidthOf({ width: layout.width, mode: asideMode, railWidth });
  const spacerWidth = drawerAsideWidthOf({ width: 0, mode: 'closed', railWidth });
  const isEdgeShown = (isOverlayOpen || isOverlayExit) && !isParked;
  const asideStyle: CSSProperties & Readonly<Record<typeof PANEL_VAR, string>> = {
    width: asideWidth,
    [PANEL_VAR]: `${layout.width}px`,
  };
  const mountSnapshot = useCallback(
    (node: HTMLDivElement | null) => {
      if (node !== null && exit.snapshot !== null) {
        mountExitSnapshot({ host: node, snapshot: exit.snapshot });
      }
    },
    [exit.snapshot],
  );
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

  useEffect(() => {
    const card = cardRef.current;
    if (!isOverlayOpen || isParked || card === null || card.contains(document.activeElement)) {
      return;
    }
    (card.querySelector<HTMLElement>(FOCUSABLE) ?? card).focus({ preventScroll: true });
  }, [isOverlayOpen, isParked]);

  const isPushed = mode === 'push' && !isParked;
  const isSheet = frame === 'sheet';
  const isBesideRail = hasRail || isPushed;
  const sheetState: SheetEdge = isBesideRail ? 'pushed' : sheetEdge;

  return (
    <DrawerContentContext.Provider
      value={{ columnWidth: column.width, savedWidth: resizable.width, mode }}
    >
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
          inert={isOverlay && !isParked}
          {...(isSheet && { 'data-sheet': sheetState, 'data-left-resize': leftResize })}
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            isSheet && 'overflow-hidden bg-background',
            isSheet && SHEET_CLASSES[sheetState],
          )}
        >
          <DrawerEdgeContext.Provider value={edge.host}>{main}</DrawerEdgeContext.Provider>
        </div>
        {isEdgeShown ? (
          <div
            aria-hidden
            data-drawer-scrim=""
            onMouseDown={isExiting ? undefined : (event) => event.preventDefault()}
            onClick={isExiting ? undefined : () => dismissTopEscapeLayer()}
            className={cn(
              'absolute inset-0 z-10 bg-scrim',
              isSheet && SCRIM_RADIUS[sheetState],
              isOverlayExit && 'pointer-events-none animate-drawer-fade-out',
              !isOverlayExit && !exit.isResumed && 'motion-safe:animate-fade-in',
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
          data-drawer-mode={isParked ? 'closed' : mode}
          data-drawer-parked={isParked ? '' : undefined}
          data-drawer-exit={isExiting ? '' : undefined}
          data-drawer-sizing={sizing}
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
            <div
              className={cn('flex w-2 shrink-0 justify-center', isOverlay && 'pointer-events-auto')}
            >
              {isOpen && !isParked ? (
                <ResizeHandle
                  {...resizable.handleProps}
                  max={layout.dragMax}
                  value={layout.width}
                  side="right"
                  ariaLabel={resizeLabel}
                />
              ) : null}
            </div>
            <div
              data-container="drawer"
              className={cn(
                'relative flex min-h-0 min-w-0 flex-1 overflow-clip rounded-l-frame border-y border-l border-frame-edge bg-drawer',
                isFloating && 'pointer-events-auto shadow-xl',
              )}
            >
              {isOpen || isExiting ? (
                <div
                  ref={cardRef}
                  data-drawer-card=""
                  tabIndex={isOverlay ? -1 : undefined}
                  inert={!isOpen || isParked || isExiting}
                  style={isParked ? { width: layout.width } : undefined}
                  className={cn(
                    'flex min-h-0 min-w-0 flex-col items-end overflow-clip',
                    isParked ? 'invisible absolute inset-y-0 left-0' : 'flex-1',
                    isOverlay && 'focus-visible:outline-none',
                    isOverlay && !exit.isResumed && 'motion-safe:animate-drawer-overlay-in',
                    isExiting && 'pointer-events-none',
                    isOverlayExit &&
                      'motion-safe:animate-drawer-overlay-out motion-reduce:animate-drawer-fade-out',
                  )}
                >
                  <div
                    data-drawer-content=""
                    className={cn(
                      'flex min-h-0 min-w-0 flex-1 flex-col',
                      !isFloating && PUSH_CONTENT,
                      !isFloating &&
                        !isExiting &&
                        !exit.isResumed &&
                        'motion-safe:animate-drawer-content-in',
                      isPushExit && 'motion-safe:animate-drawer-content-out',
                    )}
                  >
                    <div
                      key={isExiting ? `${drawerKey}:exit` : drawerKey}
                      ref={isExiting ? mountSnapshot : contentRef}
                      className={cn(
                        'flex min-h-0 min-w-0 flex-1 flex-col',
                        !isExiting && 'motion-safe:animate-drawer-swap',
                      )}
                    >
                      <DrawerParkedContext.Provider value={isParked}>
                        {isOpen ? drawer : null}
                      </DrawerParkedContext.Provider>
                    </div>
                  </div>
                </div>
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
