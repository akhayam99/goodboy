import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { cn } from '../cn';
import { dismissTopEscapeLayer } from '../escape';
import { SHEET_CLASSES, type ResizeActivity, type SheetEdge } from '../sheet';
import { ResizeHandle } from './ResizeHandle';
import { useDrawerExit } from '../useDrawerExit';
import { useResizableWidth } from '../useResizableWidth';
import {
  DRAWER_TIERS,
  drawerAsideWidthOf,
  drawerLayoutOf,
  type DrawerLayout,
  type DrawerMode,
  type DrawerPlacement,
  type DrawerSizing,
} from '../drawerGeometry';

export const RIGHT_DRAWER_STORAGE_KEY = 'goodboy:right-drawer-width:v1';
export const READER_DRAWER_STORAGE_KEY = 'goodboy:reader-drawer-width:v1';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

const useMeasuredWidth = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (node === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
};

type UnmeasuredParams = {
  readonly savedWidth: number;
  readonly sizing: DrawerSizing;
  readonly placement: DrawerPlacement;
};

const unmeasuredLayoutOf = ({ savedWidth, sizing, placement }: UnmeasuredParams): DrawerLayout => ({
  mode: placement === 'overlay' ? 'overlay' : 'push',
  width: savedWidth,
  dragMax: DRAWER_TIERS[sizing].max,
});

export type DrawerColumnFrame = 'sheet' | 'none';

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
  className,
}: DrawerColumnProps) => {
  const column = useMeasuredWidth();
  const asideRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const isOpen = drawer != null;
  const modeRef = useRef<DrawerMode>('closed');
  const onPreview = (next: number) => {
    const track = `${drawerAsideWidthOf({ width: next, mode: modeRef.current })}px`;
    asideRef.current?.style.setProperty('width', track);
    trackRef.current?.style.setProperty('min-width', track);
  };
  const side = useResizableWidth<HTMLElement>({
    storageKey: RIGHT_DRAWER_STORAGE_KEY,
    defaultWidth: DRAWER_TIERS.side.fallback,
    min: DRAWER_TIERS.side.min,
    max: DRAWER_TIERS.side.max,
    cssVar: '--goodboy-drawer-width',
    onPreview,
  });
  const reader = useResizableWidth<HTMLElement>({
    storageKey: READER_DRAWER_STORAGE_KEY,
    defaultWidth: DRAWER_TIERS.reader.fallback,
    min: DRAWER_TIERS.reader.min,
    max: DRAWER_TIERS.reader.max,
    cssVar: '--goodboy-reader-drawer-width',
    onPreview,
  });
  const resizable = sizing === 'reader' ? reader : side;
  const layout =
    column.width === null
      ? unmeasuredLayoutOf({ savedWidth: resizable.width, sizing, placement })
      : drawerLayoutOf({ main: column.width, sizing, savedWidth: resizable.width, placement });
  const mode: DrawerMode = isOpen ? layout.mode : 'closed';
  modeRef.current = mode;
  const isOverlay = mode === 'overlay';
  const isOverlayOpen = isOpen && isOverlay;
  const exit = useDrawerExit({ isOpen, layoutMode: layout.mode, cardRef });
  const isExiting = exit.isExiting;
  const isCapturing = exit.isCapturing;
  const lastDrawerRef = useRef<ReactNode>(null);
  if (isOpen) {
    lastDrawerRef.current = drawer;
  }
  const shownDrawer = isOpen ? drawer : lastDrawerRef.current;
  if (!isOpen && !isCapturing) {
    lastDrawerRef.current = null;
  }
  const isFloating = isOverlay || isExiting || (mode === 'closed' && exit.lastMode === 'overlay');
  const asideWidth = drawerAsideWidthOf({
    width: layout.width,
    mode: isExiting ? 'overlay' : mode,
  });
  const mountSnapshot = useCallback(
    (node: HTMLDivElement | null) => {
      if (node !== null && exit.snapshot !== null) {
        node.appendChild(exit.snapshot);
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
    if (!isOverlayOpen || card === null || card.contains(document.activeElement)) {
      return;
    }
    (card.querySelector<HTMLElement>(FOCUSABLE) ?? card).focus({ preventScroll: true });
  }, [isOverlayOpen]);

  const isPushed = mode === 'push';
  const isSheet = frame === 'sheet';
  const sheetState: SheetEdge = isPushed ? 'pushed' : sheetEdge;

  return (
    <div
      ref={column.ref}
      className={cn(
        'relative flex min-h-0 min-w-0 flex-1 overflow-hidden',
        isSheet && isPushed && 'pb-2',
        className,
      )}
    >
      <div
        data-container="page"
        data-drawer-main=""
        inert={isOverlay}
        {...(isSheet && { 'data-sheet': sheetState, 'data-left-resize': leftResize })}
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          isSheet && 'overflow-hidden bg-background',
          isSheet && SHEET_CLASSES[sheetState],
        )}
      >
        {main}
      </div>
      {isOverlayOpen || isExiting ? (
        <div
          aria-hidden
          data-drawer-scrim=""
          onMouseDown={isExiting ? undefined : (event) => event.preventDefault()}
          onClick={isExiting ? undefined : () => dismissTopEscapeLayer()}
          className={cn(
            'absolute inset-0 z-10 bg-scrim',
            isExiting && 'pointer-events-none animate-drawer-fade-out',
            !isExiting && !exit.isResumed && 'motion-safe:animate-fade-in',
          )}
        />
      ) : null}
      <aside
        ref={setAside}
        aria-label={ariaLabel}
        data-drawer-mode={mode}
        data-drawer-exit={isExiting ? '' : undefined}
        data-drawer-sizing={sizing}
        inert={!isOpen}
        style={{ width: asideWidth }}
        className={cn(
          'flex min-h-0 shrink-0',
          isFloating
            ? 'pointer-events-none absolute inset-y-0 right-0 z-20'
            : 'relative overflow-hidden motion-safe:transition-[width]',
          'duration-180 ease-out',
        )}
      >
        {isOpen || isCapturing || isExiting ? (
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1',
              !isFloating && 'pr-2',
              !isFloating && !isSheet && 'py-2',
            )}
            ref={trackRef}
            style={{ minWidth: asideWidth }}
          >
            <div
              className={cn('flex w-2 shrink-0 justify-center', isOverlay && 'pointer-events-auto')}
            >
              {isOpen ? (
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
              ref={cardRef}
              data-container="drawer"
              data-drawer-card=""
              tabIndex={isOverlay ? -1 : undefined}
              inert={isExiting}
              className={cn(
                'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-drawer',
                isFloating
                  ? 'rounded-l-frame border-l border-frame-edge shadow-xl focus-visible:outline-none'
                  : 'rounded-frame border border-frame-edge motion-safe:animate-drawer-card-in',
                isOverlay && 'pointer-events-auto',
                isOverlay && !exit.isResumed && 'motion-safe:animate-drawer-overlay-in',
                isExiting &&
                  'pointer-events-none motion-safe:animate-drawer-overlay-out motion-reduce:animate-drawer-fade-out',
              )}
            >
              <div
                key={isExiting ? `${drawerKey}:exit` : drawerKey}
                ref={isExiting ? mountSnapshot : undefined}
                className={cn(
                  'flex min-h-0 min-w-0 flex-1 flex-col',
                  !isExiting && 'motion-safe:animate-drawer-swap',
                )}
              >
                {isOpen || isCapturing ? shownDrawer : null}
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
};
