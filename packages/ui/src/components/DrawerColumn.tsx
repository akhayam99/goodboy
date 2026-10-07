import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { cn } from '../cn';
import { dismissTopEscapeLayer } from '../escape';
import { ResizeHandle } from './ResizeHandle';
import { useResizableWidth } from '../useResizableWidth';
import {
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MAX,
  RIGHT_DRAWER_MIN,
  drawerAsideWidthOf,
  drawerLayoutOf,
  type DrawerLayout,
  type DrawerMode,
  type DrawerSizing,
} from '../drawerGeometry';

export const RIGHT_DRAWER_STORAGE_KEY = 'goodboy:right-drawer-width:v1';

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

const unmeasuredLayoutOf = ({ savedWidth }: { readonly savedWidth: number }): DrawerLayout => ({
  mode: 'push',
  width: savedWidth,
  dragMax: RIGHT_DRAWER_MAX,
});

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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const ceiling =
    column.width === null
      ? RIGHT_DRAWER_MAX
      : drawerLayoutOf({ main: column.width, sizing, savedWidth: RIGHT_DRAWER_DEFAULT }).dragMax;
  const isOpen = drawer != null;
  const modeRef = useRef<DrawerMode>('closed');
  const resizable = useResizableWidth<HTMLElement>({
    storageKey: RIGHT_DRAWER_STORAGE_KEY,
    defaultWidth: RIGHT_DRAWER_DEFAULT,
    min: RIGHT_DRAWER_MIN,
    max: ceiling,
    cssVar: '--goodboy-drawer-width',
    onPreview: (next) => {
      const track = `${drawerAsideWidthOf({ width: next, mode: modeRef.current })}px`;
      asideRef.current?.style.setProperty('width', track);
      trackRef.current?.style.setProperty('min-width', track);
    },
  });
  const layout =
    column.width === null
      ? unmeasuredLayoutOf({ savedWidth: resizable.width })
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

  return (
    <div
      ref={column.ref}
      className={cn('relative flex min-h-0 min-w-0 flex-1 overflow-hidden', className)}
    >
      <div data-drawer-main="" inert={isOverlay} className="flex min-h-0 min-w-0 flex-1 flex-col">
        {main}
      </div>
      {isOverlayOpen ? (
        <div
          aria-hidden
          data-drawer-scrim=""
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
            className="flex min-h-0 min-w-0 flex-1"
            ref={trackRef}
            style={{ minWidth: asideWidth }}
          >
            <div
              className={cn('flex w-2 shrink-0 justify-center', isOverlay && 'pointer-events-auto')}
            >
              {sizing === 'default' ? (
                <ResizeHandle
                  {...resizable.handleProps}
                  value={layout.width}
                  side="right"
                  ariaLabel={resizeLabel}
                />
              ) : null}
            </div>
            <div
              ref={cardRef}
              data-drawer-card=""
              tabIndex={isOverlay ? -1 : undefined}
              className={cn(
                'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-subtle',
                isOverlay
                  ? 'pointer-events-auto rounded-l-frame border-l border-border shadow-xl focus-visible:outline-none motion-safe:animate-drawer-overlay-in'
                  : 'my-2 mr-2 rounded-frame border border-border motion-safe:animate-drawer-card-in',
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
