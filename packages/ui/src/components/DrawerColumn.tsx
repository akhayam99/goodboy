import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { cn } from '../cn';
import { dismissTopEscapeLayer } from '../escape';
import { SHEET_CLASSES, type ResizeActivity, type SheetEdge } from '../sheet';
import { ResizeHandle } from './ResizeHandle';
import { useResizableWidth } from '../useResizableWidth';
import {
  DRAWER_TIERS,
  drawerAsideWidthOf,
  drawerLayoutOf,
  drawerTierOf,
  type DrawerLayout,
  type DrawerMode,
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
};

const unmeasuredLayoutOf = ({ savedWidth, sizing }: UnmeasuredParams): DrawerLayout => ({
  mode: 'push',
  width: savedWidth,
  dragMax: DRAWER_TIERS[drawerTierOf(sizing)].max,
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
  const resizable = drawerTierOf(sizing) === 'reader' ? reader : side;
  const layout =
    column.width === null
      ? unmeasuredLayoutOf({ savedWidth: resizable.width, sizing })
      : drawerLayoutOf({ main: column.width, sizing, savedWidth: resizable.width });
  const mode: DrawerMode = isOpen ? layout.mode : 'closed';
  modeRef.current = mode;
  const isOverlay = mode === 'overlay';
  const isOverlayOpen = isOpen && isOverlay;
  const asideWidth = drawerAsideWidthOf({ width: layout.width, mode });
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
      {isOverlayOpen ? (
        <div
          aria-hidden
          data-drawer-scrim=""
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => dismissTopEscapeLayer()}
          className="absolute inset-0 z-10 bg-scrim motion-safe:animate-fade-in"
        />
      ) : null}
      <aside
        ref={setAside}
        aria-label={ariaLabel}
        data-drawer-mode={mode}
        data-drawer-sizing={sizing}
        inert={!isOpen}
        style={{ width: asideWidth }}
        className={cn(
          'flex min-h-0 shrink-0',
          isOverlay
            ? 'pointer-events-none absolute inset-y-0 right-0 z-20'
            : 'relative overflow-hidden motion-safe:transition-[width]',
          'duration-180 ease-out',
        )}
      >
        {isOpen ? (
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1',
              !isOverlay && 'pr-2',
              !isOverlay && !isSheet && 'py-2',
            )}
            ref={trackRef}
            style={{ minWidth: asideWidth }}
          >
            <div
              className={cn('flex w-2 shrink-0 justify-center', isOverlay && 'pointer-events-auto')}
            >
              {sizing === 'full' ? null : (
                <ResizeHandle
                  {...resizable.handleProps}
                  max={layout.dragMax}
                  value={layout.width}
                  side="right"
                  ariaLabel={resizeLabel}
                />
              )}
            </div>
            <div
              ref={cardRef}
              data-container="drawer"
              data-drawer-card=""
              tabIndex={isOverlay ? -1 : undefined}
              className={cn(
                'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-drawer',
                isOverlay
                  ? 'pointer-events-auto rounded-l-frame border-l border-frame-edge shadow-xl focus-visible:outline-none motion-safe:animate-drawer-overlay-in'
                  : 'rounded-frame border border-frame-edge motion-safe:animate-drawer-card-in',
              )}
            >
              <div
                key={drawerKey}
                className="flex min-h-0 min-w-0 flex-1 flex-col motion-safe:animate-drawer-swap"
              >
                {drawer}
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
};
