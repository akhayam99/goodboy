import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../cn';
import { ResizeHandle } from './ResizeHandle';

export type AppShellProps = {
  readonly topBar?: ReactNode;
  readonly footer?: ReactNode;
  readonly leftSidebar?: ReactNode;
  readonly leftHidden?: boolean;
  readonly leftSidebarCollapsed?: boolean;
  readonly leftOverlay?: ReactNode;
  readonly main: ReactNode;
  readonly overlay?: ReactNode;
  readonly className?: string;
};

export const LEFT_SIDEBAR_MIN = 260;
export const LEFT_SIDEBAR_MAX = 640;
export const LEFT_SIDEBAR_DEFAULT = 340;
export const LEFT_SIDEBAR_STORAGE_KEY = 'goodboy:left-sidebar-width:v2';

const LEFT_RAIL_WIDTH = 44;

const readPersistedLeftWidth = (): number => {
  if (typeof localStorage === 'undefined') {
    return LEFT_SIDEBAR_DEFAULT;
  }
  const raw = localStorage.getItem(LEFT_SIDEBAR_STORAGE_KEY);
  if (raw === null || raw === '') {
    return LEFT_SIDEBAR_DEFAULT;
  }
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return LEFT_SIDEBAR_DEFAULT;
  }
  return Math.max(LEFT_SIDEBAR_MIN, Math.min(LEFT_SIDEBAR_MAX, parsed));
};

type LayoutParams = {
  readonly leftCollapsed: boolean;
  readonly leftHidden: boolean;
  readonly hasLeftSidebar: boolean;
  readonly hasFooter: boolean;
  readonly leftWidthPx: number;
};

type Layout = {
  readonly templateAreas: string;
  readonly templateColumns: string;
  readonly templateRows: string;
};

const buildLayout = ({
  leftCollapsed,
  leftHidden,
  hasLeftSidebar,
  hasFooter,
  leftWidthPx,
}: LayoutParams): Layout => {
  const rows = hasFooter ? 'minmax(0,1fr) auto' : 'minmax(0,1fr)';
  if (!hasLeftSidebar) {
    return {
      templateAreas: hasFooter ? '"main" "footer"' : '"main"',
      templateColumns: 'minmax(0,1fr)',
      templateRows: rows,
    };
  }
  const leftCol = leftHidden ? '0px' : leftCollapsed ? `${LEFT_RAIL_WIDTH}px` : `${leftWidthPx}px`;
  const handleCol = leftHidden || leftCollapsed ? '0px' : '6px';
  return {
    templateAreas: hasFooter ? '"left lhandle main" "footer footer footer"' : '"left lhandle main"',
    templateColumns: `${leftCol} ${handleCol} minmax(0,1fr)`,
    templateRows: rows,
  };
};

export const AppShell = ({
  topBar,
  footer,
  leftSidebar,
  leftHidden = false,
  leftSidebarCollapsed = false,
  leftOverlay,
  main,
  overlay,
  className,
}: AppShellProps) => {
  const hasFooter = footer != null;
  const hasLeftSidebar = leftSidebar != null;
  const isLeftResizeDisabled = leftHidden || leftSidebarCollapsed;
  const [leftWidth, setLeftWidth] = useState<number>(readPersistedLeftWidth);
  useEffect(() => {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(LEFT_SIDEBAR_STORAGE_KEY, String(leftWidth));
  }, [leftWidth]);

  const layout = buildLayout({
    leftCollapsed: leftSidebarCollapsed,
    leftHidden,
    hasLeftSidebar,
    hasFooter,
    leftWidthPx: leftWidth,
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
            style={{ gridColumn: 'main', gridRow: '1 / 2' }}
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
