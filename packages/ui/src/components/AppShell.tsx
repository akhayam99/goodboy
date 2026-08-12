import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../cn';
import { ResizeHandle } from './ResizeHandle';

export type AppShellProps = {
  topBar?: ReactNode;
  footer?: ReactNode;
  leftSidebar?: ReactNode;
  leftHidden?: boolean;
  leftSidebarCollapsed?: boolean;
  leftOverlay?: ReactNode;
  main: ReactNode;
  rightSidebar: ReactNode;
  rightSidebarCollapsed?: boolean;
  overlay?: ReactNode;
  className?: string;
};

export const LEFT_SIDEBAR_MIN = 260;
export const LEFT_SIDEBAR_MAX = 640;
export const LEFT_SIDEBAR_DEFAULT = 340;
export const LEFT_SIDEBAR_STORAGE_KEY = 'goodboy:left-sidebar-width:v2';

const RIGHT_SIDEBAR_MIN = 260;
const RIGHT_SIDEBAR_MAX = 560;
const RIGHT_SIDEBAR_DEFAULT = 340;
export const RIGHT_SIDEBAR_STORAGE_KEY = 'goodboy:right-sidebar-width';
const RIGHT_RAIL_WIDTH = 44;
const LEFT_RAIL_WIDTH = 44;

function readPersistedWidth(key: string, def: number, min: number, max: number): number {
  if (typeof localStorage === 'undefined') {
    return def;
  }
  const raw = localStorage.getItem(key);
  if (!raw) {
    return def;
  }
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return def;
  }
  return Math.max(min, Math.min(max, parsed));
}

function buildLayout(opts: {
  collapsed: boolean;
  leftCollapsed: boolean;
  leftHidden: boolean;
  hasLeftSidebar: boolean;
  hasRightSidebar: boolean;
  hasFooter: boolean;
  leftWidthPx: number;
  rightWidthPx: number;
}): {
  templateAreas: string;
  templateColumns: string;
  templateRows: string;
} {
  const {
    collapsed,
    leftCollapsed,
    leftHidden,
    hasLeftSidebar,
    hasRightSidebar,
    hasFooter,
    leftWidthPx,
    rightWidthPx,
  } = opts;

  const rows = hasFooter ? 'minmax(0,1fr) 2.25rem' : 'minmax(0,1fr)';

  if (!hasLeftSidebar) {
    if (!hasRightSidebar) {
      return {
        templateAreas: hasFooter ? '"main" "footer"' : '"main"',
        templateColumns: 'minmax(0,1fr)',
        templateRows: rows,
      };
    }
    return {
      templateAreas: hasFooter
        ? '"main rhandle right" "footer footer footer"'
        : '"main rhandle right"',
      templateColumns: `minmax(0,1fr) ${collapsed ? '0px' : '6px'} ${
        collapsed ? RIGHT_RAIL_WIDTH : rightWidthPx
      }px`,
      templateRows: rows,
    };
  }

  const leftCol = leftHidden ? '0px' : leftCollapsed ? `${LEFT_RAIL_WIDTH}px` : `${leftWidthPx}px`;
  const handleCol = leftHidden || leftCollapsed ? '0px' : '6px';
  if (!hasRightSidebar) {
    return {
      templateAreas: hasFooter
        ? '"left lhandle main" "footer footer footer"'
        : '"left lhandle main"',
      templateColumns: `${leftCol} ${handleCol} minmax(0,1fr)`,
      templateRows: rows,
    };
  }
  return {
    templateAreas: hasFooter
      ? '"left lhandle main rhandle right" "footer footer footer footer footer"'
      : '"left lhandle main rhandle right"',
    templateColumns: `${leftCol} ${handleCol} minmax(0,1fr) ${collapsed ? '0px' : '6px'} ${
      collapsed ? RIGHT_RAIL_WIDTH : rightWidthPx
    }px`,
    templateRows: rows,
  };
}

export const AppShell = ({
  topBar,
  footer,
  leftSidebar,
  leftHidden = false,
  leftSidebarCollapsed = false,
  leftOverlay,
  main,
  rightSidebar,
  rightSidebarCollapsed = false,
  overlay,
  className,
}: AppShellProps) => {
  const hasFooter = footer != null;
  const hasLeftSidebar = leftSidebar != null;
  const hasRightSidebar = rightSidebar !== null && rightSidebar !== undefined;
  const isLeftResizeDisabled = leftHidden || leftSidebarCollapsed;
  const [leftWidth, setLeftWidth] = useState<number>(() =>
    readPersistedWidth(
      LEFT_SIDEBAR_STORAGE_KEY,
      LEFT_SIDEBAR_DEFAULT,
      LEFT_SIDEBAR_MIN,
      LEFT_SIDEBAR_MAX,
    ),
  );
  const [rightWidth, setRightWidth] = useState<number>(() =>
    readPersistedWidth(
      RIGHT_SIDEBAR_STORAGE_KEY,
      RIGHT_SIDEBAR_DEFAULT,
      RIGHT_SIDEBAR_MIN,
      RIGHT_SIDEBAR_MAX,
    ),
  );
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
    localStorage.setItem(RIGHT_SIDEBAR_STORAGE_KEY, String(rightWidth));
  }, [rightWidth]);

  const layout = buildLayout({
    collapsed: rightSidebarCollapsed,
    leftCollapsed: leftSidebarCollapsed,
    leftHidden,
    hasLeftSidebar,
    hasRightSidebar,
    hasFooter,
    leftWidthPx: leftWidth,
    rightWidthPx: rightWidth,
  });
  const gridStyle: CSSProperties = {
    gridTemplateAreas: layout.templateAreas,
    gridTemplateColumns: layout.templateColumns,
    gridTemplateRows: layout.templateRows,
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      {topBar != null ? <div className="shrink-0">{topBar}</div> : null}
      <div
        className={cn(
          'grid min-h-0 w-full flex-1 overflow-hidden text-foreground motion-safe:transition-[grid-template-columns] duration-200 ease-out',
          className,
        )}
        style={gridStyle}
      >
        {hasLeftSidebar ? (
          <aside
            className={cn(
              'flex min-h-0 min-w-0 flex-col overflow-hidden bg-background motion-safe:transition-[opacity,transform] duration-200 ease-out',
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
              />
            )}
          </div>
        ) : null}
        <main
          className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background"
          style={{ gridArea: 'main' }}
        >
          {main}
        </main>
        {hasRightSidebar ? (
          <div className="min-h-0" style={{ gridArea: 'rhandle' }}>
            {rightSidebarCollapsed ? null : (
              <ResizeHandle
                value={rightWidth}
                min={RIGHT_SIDEBAR_MIN}
                max={RIGHT_SIDEBAR_MAX}
                onChange={setRightWidth}
                onReset={() => setRightWidth(RIGHT_SIDEBAR_DEFAULT)}
                side="right"
                ariaLabel="Resize right sidebar"
              />
            )}
          </div>
        ) : null}
        {hasRightSidebar ? (
          <aside
            className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background"
            style={{ gridArea: 'right' }}
          >
            {rightSidebar}
          </aside>
        ) : null}
        {leftOverlay != null ? (
          <div
            className="pointer-events-none relative z-20 flex min-h-0 min-w-0"
            style={{ gridColumn: '1 / -1', gridRow: '1 / 2' }}
          >
            {leftOverlay}
          </div>
        ) : null}
        {overlay != null ? (
          <div
            className="relative z-30 flex min-h-0 min-w-0 flex-col overflow-hidden"
            style={{
              gridColumn: hasRightSidebar ? 'main-start / right-end' : 'main',
              gridRow: '1 / 2',
            }}
          >
            {overlay}
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
