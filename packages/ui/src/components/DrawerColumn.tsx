import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { cn } from '../cn';
import { ResizeHandle } from './ResizeHandle';
import { useResizableWidth } from '../useResizableWidth';

const RIGHT_DRAWER_MIN = 340;
export const RIGHT_DRAWER_MAX = 560;
export const RIGHT_DRAWER_DEFAULT = 400;
export const RIGHT_DRAWER_STORAGE_KEY = 'goodboy:right-drawer-width:v1';
export const COLUMN_MIN_PUSH = 560;
export const COLUMN_GUTTERS = 48;
export const DRAWER_INSET = 8;

type PushParams = {
  readonly mainWidthPx: number;
  readonly drawerWidthPx: number;
};

export const canDrawerPush = ({ mainWidthPx, drawerWidthPx }: PushParams): boolean =>
  mainWidthPx - drawerWidthPx - COLUMN_GUTTERS >= COLUMN_MIN_PUSH;

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

export type DrawerSizing = 'default' | 'half' | 'full';

type SizedParams = {
  readonly sizing: DrawerSizing;
  readonly columnWidth: number | null;
  readonly resizableWidth: number;
};

const sizedWidth = ({ sizing, columnWidth, resizableWidth }: SizedParams): number => {
  if (sizing === 'default' || columnWidth === null) {
    return resizableWidth;
  }
  if (sizing === 'full') {
    return Math.max(RIGHT_DRAWER_MIN, columnWidth - DRAWER_INSET * 2);
  }
  return Math.max(RIGHT_DRAWER_MIN, Math.round(columnWidth / 2) - DRAWER_INSET * 2);
};

export type DrawerColumnProps = {
  readonly main: ReactNode;
  readonly drawer?: ReactNode | null;
  readonly drawerKey?: string;
  readonly ariaLabel: string;
  readonly resizeLabel: string;
  readonly drawerRef?: Ref<HTMLElement>;
  readonly sizing?: DrawerSizing;
  readonly className?: string;
};

export const DrawerColumn = ({
  main,
  drawer,
  drawerKey = 'drawer',
  ariaLabel,
  resizeLabel,
  drawerRef,
  sizing = 'default',
  className,
}: DrawerColumnProps) => {
  const column = useMeasuredWidth();
  const asideRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const resizable = useResizableWidth<HTMLElement>({
    storageKey: RIGHT_DRAWER_STORAGE_KEY,
    defaultWidth: RIGHT_DRAWER_DEFAULT,
    min: RIGHT_DRAWER_MIN,
    max: RIGHT_DRAWER_MAX,
    cssVar: '--goodboy-drawer-width',
    onPreview: (next) => {
      const track = `${next + DRAWER_INSET * 2}px`;
      asideRef.current?.style.setProperty('width', track);
      trackRef.current?.style.setProperty('min-width', track);
    },
  });
  const width = sizedWidth({
    sizing,
    columnWidth: column.width,
    resizableWidth: resizable.width,
  });
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
  const isOpen = drawer != null;
  const isOverlay =
    column.width !== null &&
    (sizing === 'full' || !canDrawerPush({ mainWidthPx: column.width, drawerWidthPx: width }));
  const mode = !isOpen ? 'closed' : isOverlay ? 'overlay' : 'push';
  const trackWidth = width + DRAWER_INSET * 2;

  return (
    <div
      ref={column.ref}
      className={cn('relative flex min-h-0 min-w-0 flex-1 overflow-hidden', className)}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{main}</div>
      <aside
        ref={setAside}
        aria-label={ariaLabel}
        data-drawer-mode={mode}
        data-drawer-sizing={sizing}
        inert={!isOpen}
        style={{ width: isOpen ? trackWidth : 0 }}
        className={cn(
          'flex min-h-0 shrink-0 overflow-hidden',
          isOverlay
            ? 'pointer-events-none absolute inset-y-0 right-0 z-20'
            : 'relative motion-safe:transition-[width]',
          isOpen ? 'duration-220 ease-emphasized' : 'duration-160 ease-in',
        )}
      >
        {isOpen ? (
          <div
            className={cn('flex min-h-0 min-w-0 flex-1', isOverlay && 'pointer-events-auto')}
            ref={trackRef}
            style={{ minWidth: trackWidth }}
          >
            <div className="flex w-2 shrink-0 justify-center">
              {sizing === 'default' ? (
                <ResizeHandle {...resizable.handleProps} side="right" ariaLabel={resizeLabel} />
              ) : null}
            </div>
            <div
              data-drawer-card=""
              className={cn(
                'my-2 mr-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-frame border border-border bg-subtle',
                isOverlay
                  ? 'shadow-lg motion-safe:animate-drawer-overlay-in'
                  : 'motion-safe:animate-drawer-card-in',
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
