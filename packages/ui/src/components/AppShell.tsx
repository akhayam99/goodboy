import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../cn';
import { SHEET_CLASSES, type ResizeActivity } from '../sheet';
import { ResizeHandle } from './ResizeHandle';

export type AppShellProps = {
  readonly topBar?: ReactNode;
  readonly footer?: ReactNode;
  readonly leftSidebar?: ReactNode;
  readonly leftHidden?: boolean;
  readonly leftSidebarCollapsed?: boolean;
  readonly leftOverlay?: ReactNode;
  readonly main: ReactNode;
  readonly drawer?: ReactNode;
  readonly studio?: ReactNode;
  readonly className?: string;
};

export const LEFT_SIDEBAR_MIN = 260;
export const LEFT_SIDEBAR_MAX = 640;
export const LEFT_SIDEBAR_DEFAULT = 340;
export const LEFT_SIDEBAR_STORAGE_KEY = 'goodboy:left-sidebar-width:v2';

export const RIGHT_DRAWER_MIN = 340;
export const RIGHT_DRAWER_MAX = 560;
export const RIGHT_DRAWER_DEFAULT = 400;
export const RIGHT_DRAWER_STORAGE_KEY = 'goodboy:right-drawer-width:v1';
export const COLUMN_MIN_PUSH = 560;
export const COLUMN_GUTTERS = 48;

export const COLLAPSED_RAIL_WIDTH = 44;

const HANDLE_WIDTH = 6;

type ReadWidthParams = {
  readonly key: string;
  readonly fallback: number;
  readonly min: number;
  readonly max: number;
};

const readPersistedWidth = ({ key, fallback, min, max }: ReadWidthParams): number => {
  if (typeof localStorage === 'undefined') {
    return fallback;
  }
  const raw = localStorage.getItem(key);
  if (raw === null || raw === '') {
    return fallback;
  }
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
};

const readPersistedLeftWidth = (): number =>
  readPersistedWidth({
    key: LEFT_SIDEBAR_STORAGE_KEY,
    fallback: LEFT_SIDEBAR_DEFAULT,
    min: LEFT_SIDEBAR_MIN,
    max: LEFT_SIDEBAR_MAX,
  });

const readPersistedDrawerWidth = (): number =>
  readPersistedWidth({
    key: RIGHT_DRAWER_STORAGE_KEY,
    fallback: RIGHT_DRAWER_DEFAULT,
    min: RIGHT_DRAWER_MIN,
    max: RIGHT_DRAWER_MAX,
  });

type PushParams = {
  readonly mainWidthPx: number;
  readonly drawerWidthPx: number;
};

export const canDrawerPush = ({ mainWidthPx, drawerWidthPx }: PushParams): boolean =>
  mainWidthPx - drawerWidthPx - COLUMN_GUTTERS >= COLUMN_MIN_PUSH;

type LayoutParams = {
  readonly leftCollapsed: boolean;
  readonly leftHidden: boolean;
  readonly hasLeftSidebar: boolean;
  readonly hasFooter: boolean;
  readonly leftWidthPx: number;
  readonly isDrawerPushed: boolean;
  readonly drawerWidthPx: number;
};

type Layout = {
  readonly templateAreas: string;
  readonly templateColumns: string;
  readonly templateRows: string;
};

const leftColumnWidth = ({
  leftCollapsed,
  leftHidden,
  leftWidthPx,
}: Pick<LayoutParams, 'leftCollapsed' | 'leftHidden' | 'leftWidthPx'>): number => {
  if (leftHidden) {
    return 0;
  }
  if (leftCollapsed) {
    return COLLAPSED_RAIL_WIDTH;
  }
  return leftWidthPx;
};

const buildLayout = ({
  leftCollapsed,
  leftHidden,
  hasLeftSidebar,
  hasFooter,
  leftWidthPx,
  isDrawerPushed,
  drawerWidthPx,
}: LayoutParams): Layout => {
  const rows = hasFooter ? 'minmax(0,1fr) auto' : 'minmax(0,1fr)';
  const rightCols = isDrawerPushed ? `${HANDLE_WIDTH}px ${drawerWidthPx}px` : '0px 0px';
  if (!hasLeftSidebar) {
    return {
      templateAreas: hasFooter
        ? '"main rhandle right" "footer footer footer"'
        : '"main rhandle right"',
      templateColumns: `minmax(0,1fr) ${rightCols}`,
      templateRows: rows,
    };
  }
  const leftCol = `${leftColumnWidth({ leftCollapsed, leftHidden, leftWidthPx })}px`;
  const handleCol = leftHidden || leftCollapsed ? '0px' : `${HANDLE_WIDTH}px`;
  return {
    templateAreas: hasFooter
      ? '"left lhandle main rhandle right" "footer footer footer footer footer"'
      : '"left lhandle main rhandle right"',
    templateColumns: `${leftCol} ${handleCol} minmax(0,1fr) ${rightCols}`,
    templateRows: rows,
  };
};

const useElementWidth = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (node === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) {
        return;
      }
      setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
};

export const AppShell = ({
  topBar,
  footer,
  leftSidebar,
  leftHidden = false,
  leftSidebarCollapsed = false,
  leftOverlay,
  main,
  drawer,
  studio,
  className,
}: AppShellProps) => {
  const hasFooter = footer != null;
  const hasLeftSidebar = leftSidebar != null;
  const isDrawerOpen = drawer != null;
  const isLeftResizeDisabled = leftHidden || leftSidebarCollapsed;
  const [leftWidth, setLeftWidth] = useState<number>(readPersistedLeftWidth);
  const [drawerWidth, setDrawerWidth] = useState<number>(readPersistedDrawerWidth);
  const grid = useElementWidth();
  const [leftResize, setLeftResize] = useState<ResizeActivity>('idle');
  const isSheetWrapped = hasLeftSidebar && !leftHidden;

  useEffect(() => {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(LEFT_SIDEBAR_STORAGE_KEY, String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, String(drawerWidth));
  }, [drawerWidth]);

  const leftTrack = hasLeftSidebar
    ? leftColumnWidth({
        leftCollapsed: leftSidebarCollapsed,
        leftHidden,
        leftWidthPx: leftWidth,
      }) + (isLeftResizeDisabled ? 0 : HANDLE_WIDTH)
    : 0;
  const isDrawerOverlay =
    isDrawerOpen &&
    grid.width !== null &&
    !canDrawerPush({ mainWidthPx: grid.width - leftTrack, drawerWidthPx: drawerWidth });
  const isDrawerPushed = isDrawerOpen && !isDrawerOverlay;

  const layout = buildLayout({
    leftCollapsed: leftSidebarCollapsed,
    leftHidden,
    hasLeftSidebar,
    hasFooter,
    leftWidthPx: leftWidth,
    isDrawerPushed,
    drawerWidthPx: drawerWidth,
  });
  const gridStyle = {
    gridTemplateAreas: layout.templateAreas,
    gridTemplateColumns: layout.templateColumns,
    gridTemplateRows: layout.templateRows,
    '--drawer-w': `${drawerWidth}px`,
  } satisfies CSSProperties & Record<'--drawer-w', string>;

  const drawerHandle = (
    <ResizeHandle
      value={drawerWidth}
      min={RIGHT_DRAWER_MIN}
      max={RIGHT_DRAWER_MAX}
      onChange={setDrawerWidth}
      onReset={() => setDrawerWidth(RIGHT_DRAWER_DEFAULT)}
      side="right"
      ariaLabel="Resize side panel"
    />
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-chrome">
      {topBar != null ? <div className="shrink-0">{topBar}</div> : null}
      <div
        ref={grid.ref}
        className={cn(
          'grid min-h-0 w-full flex-1 overflow-hidden text-foreground motion-safe:transition-[grid-template-columns] duration-200 ease-out',
          className,
        )}
        style={gridStyle}
      >
        {hasLeftSidebar ? (
          <aside
            className={cn(
              'flex min-h-0 min-w-0 flex-col overflow-hidden bg-chrome motion-safe:transition-[opacity,transform] duration-200 ease-out',
              leftHidden
                ? 'pointer-events-none -translate-x-2 opacity-0'
                : 'translate-x-0 opacity-100',
            )}
            style={{ gridArea: 'left' }}
            inert={leftHidden}
          >
            {leftSidebar}
          </aside>
        ) : null}
        {hasLeftSidebar ? (
          <div className="min-h-0" style={{ gridArea: 'lhandle' }}>
            {isLeftResizeDisabled ? null : (
              <ResizeHandle
                value={leftWidth}
                min={LEFT_SIDEBAR_MIN}
                max={LEFT_SIDEBAR_MAX}
                onChange={setLeftWidth}
                onReset={() => setLeftWidth(LEFT_SIDEBAR_DEFAULT)}
                ariaLabel="Resize left sidebar"
                onActivityChange={setLeftResize}
                drawsEdge={false}
              />
            )}
          </div>
        ) : null}
        <main
          data-sheet={isSheetWrapped ? 'wrapped' : 'flush'}
          data-left-resize={isLeftResizeDisabled ? 'idle' : leftResize}
          className={cn(
            'flex min-h-0 min-w-0 flex-col overflow-hidden bg-background',
            SHEET_CLASSES[isSheetWrapped ? 'wrapped' : 'flush'],
          )}
          style={{ gridArea: 'main' }}
        >
          {main}
        </main>
        <div className="min-h-0 overflow-hidden" style={{ gridArea: 'rhandle' }}>
          {isDrawerPushed ? drawerHandle : null}
        </div>
        <aside
          aria-label="Side panel"
          data-drawer-mode={isDrawerOverlay ? 'overlay' : isDrawerPushed ? 'push' : 'closed'}
          inert={!isDrawerOpen}
          className={cn(
            'flex min-h-0 min-w-0 overflow-hidden bg-background',
            isDrawerOverlay && 'z-20 justify-self-end shadow-xl',
          )}
          style={
            isDrawerOverlay
              ? { gridArea: 'main', width: `${drawerWidth + HANDLE_WIDTH}px` }
              : { gridArea: 'right' }
          }
        >
          {isDrawerOverlay ? drawerHandle : null}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{drawer}</div>
        </aside>
        {leftOverlay != null ? (
          <div
            className="pointer-events-none relative z-20 flex min-h-0 min-w-0"
            style={{ gridColumn: '1 / -1', gridRow: '1 / 2' }}
          >
            {leftOverlay}
          </div>
        ) : null}
        {studio != null ? (
          <div
            className="relative z-studio flex min-h-0 min-w-0 flex-col overflow-hidden empty:hidden"
            style={{ gridColumn: '1 / -1', gridRow: '1 / 2' }}
          >
            {studio}
          </div>
        ) : null}
        {hasFooter ? (
          <div className="shrink-0" style={{ gridArea: 'footer' }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};
