import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { cn } from '../cn';
import { ResizeHandle } from './ResizeHandle';

export const RIGHT_DRAWER_MIN = 340;
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

const clampWidth = (width: number): number =>
  Math.max(RIGHT_DRAWER_MIN, Math.min(RIGHT_DRAWER_MAX, width));

const readDrawerWidth = (): number => {
  try {
    const parsed = Number.parseInt(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY) ?? '', 10);
    return Number.isNaN(parsed) ? RIGHT_DRAWER_DEFAULT : clampWidth(parsed);
  } catch {
    return RIGHT_DRAWER_DEFAULT;
  }
};

const writeDrawerWidth = (width: number): void => {
  try {
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, String(width));
  } catch {
    return;
  }
};

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

export type DrawerColumnProps = {
  readonly main: ReactNode;
  readonly drawer?: ReactNode | null;
  readonly drawerKey?: string;
  readonly ariaLabel: string;
  readonly resizeLabel: string;
  readonly drawerRef?: Ref<HTMLElement>;
  readonly className?: string;
};

export const DrawerColumn = ({
  main,
  drawer,
  drawerKey = 'drawer',
  ariaLabel,
  resizeLabel,
  drawerRef,
  className,
}: DrawerColumnProps) => {
  const column = useMeasuredWidth();
  const [width, setWidth] = useState<number>(readDrawerWidth);
  const isOpen = drawer != null;
  const isOverlay =
    column.width !== null && !canDrawerPush({ mainWidthPx: column.width, drawerWidthPx: width });
  const mode = !isOpen ? 'closed' : isOverlay ? 'overlay' : 'push';
  const trackWidth = width + DRAWER_INSET * 2;

  const resize = (next: number) => {
    setWidth(next);
    writeDrawerWidth(next);
  };

  return (
    <div
      ref={column.ref}
      className={cn('relative flex min-h-0 min-w-0 flex-1 overflow-hidden', className)}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{main}</div>
      <aside
        ref={drawerRef}
        aria-label={ariaLabel}
        data-drawer-mode={mode}
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
            style={{ minWidth: trackWidth }}
          >
            <div className="flex w-2 shrink-0 justify-center">
              <ResizeHandle
                value={width}
                min={RIGHT_DRAWER_MIN}
                max={RIGHT_DRAWER_MAX}
                onChange={resize}
                onReset={() => resize(RIGHT_DRAWER_DEFAULT)}
                side="right"
                ariaLabel={resizeLabel}
              />
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
