import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../cn';

export type AppShellProps = {
  leftSidebar?: ReactNode;
  leftSidebarCollapsed?: boolean;
  main: ReactNode;
  rightSidebar: ReactNode;
  rightSidebarCollapsed?: boolean;
  className?: string;
};

const LEFT_SIDEBAR_MIN = 300;
const LEFT_SIDEBAR_MAX = 520;
const LEFT_SIDEBAR_DEFAULT = 380;
const LEFT_SIDEBAR_STORAGE_KEY = 'goodboy:left-sidebar-width';
const LEFT_RAIL_WIDTH = 80;

const RIGHT_SIDEBAR_MIN = 260;
const RIGHT_SIDEBAR_MAX = 560;
const RIGHT_SIDEBAR_DEFAULT = 340;
const RIGHT_SIDEBAR_STORAGE_KEY = 'goodboy:right-sidebar-width';
const RIGHT_RAIL_WIDTH = 44;

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
  hasLeftSidebar: boolean;
  hasRightSidebar: boolean;
  leftWidthPx: number;
  rightWidthPx: number;
}): {
  templateAreas: string;
  templateColumns: string;
  templateRows: string;
} {
  const { collapsed, leftCollapsed, hasLeftSidebar, hasRightSidebar, leftWidthPx, rightWidthPx } =
    opts;

  if (!hasLeftSidebar) {
    if (!hasRightSidebar) {
      return {
        templateAreas: '"main"',
        templateColumns: 'minmax(0,1fr)',
        templateRows: 'minmax(0,1fr)',
      };
    }
    return {
      templateAreas: '"main rhandle right"',
      templateColumns: `minmax(0,1fr) ${collapsed ? '0px' : '6px'} ${
        collapsed ? RIGHT_RAIL_WIDTH : rightWidthPx
      }px`,
      templateRows: 'minmax(0,1fr)',
    };
  }

  const leftCol = `${leftCollapsed ? LEFT_RAIL_WIDTH : leftWidthPx}px`;
  if (!hasRightSidebar) {
    return {
      templateAreas: '"left lhandle main"',
      templateColumns: `${leftCol} 6px minmax(0,1fr)`,
      templateRows: 'minmax(0,1fr)',
    };
  }
  return {
    templateAreas: '"left lhandle main rhandle right"',
    templateColumns: `${leftCol} 6px minmax(0,1fr) ${collapsed ? '0px' : '6px'} ${
      collapsed ? RIGHT_RAIL_WIDTH : rightWidthPx
    }px`,
    templateRows: 'minmax(0,1fr)',
  };
}

export const AppShell = ({
  leftSidebar,
  leftSidebarCollapsed = false,
  main,
  rightSidebar,
  rightSidebarCollapsed = false,
  className,
}: AppShellProps) => {
  const hasLeftSidebar = leftSidebar != null;
  const hasRightSidebar = rightSidebar !== null && rightSidebar !== undefined;
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
  const draggingRef = useRef<'left' | 'right' | null>(null);

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

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const which = draggingRef.current;
      if (!which) {
        return;
      }
      e.preventDefault();
      if (which === 'left') {
        const next = Math.max(LEFT_SIDEBAR_MIN, Math.min(LEFT_SIDEBAR_MAX, e.clientX));
        setLeftWidth(next);
      } else {
        const next = Math.max(
          RIGHT_SIDEBAR_MIN,
          Math.min(RIGHT_SIDEBAR_MAX, window.innerWidth - e.clientX),
        );
        setRightWidth(next);
      }
    };
    const onUp = () => {
      if (!draggingRef.current) {
        return;
      }
      draggingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startDrag = (which: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = which;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onLeftKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
      return;
    }
    e.preventDefault();
    const step = e.shiftKey ? 32 : 8;
    setLeftWidth((w) =>
      Math.max(
        LEFT_SIDEBAR_MIN,
        Math.min(LEFT_SIDEBAR_MAX, w + (e.key === 'ArrowLeft' ? -step : step)),
      ),
    );
  };

  const onRightKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
      return;
    }
    e.preventDefault();
    const step = e.shiftKey ? 32 : 8;
    setRightWidth((w) =>
      Math.max(
        RIGHT_SIDEBAR_MIN,
        Math.min(RIGHT_SIDEBAR_MAX, w + (e.key === 'ArrowLeft' ? step : -step)),
      ),
    );
  };

  const layout = buildLayout({
    collapsed: rightSidebarCollapsed,
    leftCollapsed: leftSidebarCollapsed,
    hasLeftSidebar,
    hasRightSidebar,
    leftWidthPx: leftWidth,
    rightWidthPx: rightWidth,
  });
  const gridStyle: CSSProperties = {
    gridTemplateAreas: layout.templateAreas,
    gridTemplateColumns: layout.templateColumns,
    gridTemplateRows: layout.templateRows,
  };

  return (
    <div className="h-screen w-screen bg-background">
      <div
        className={cn(
          'grid h-full w-full overflow-hidden text-foreground transition-[grid-template-columns] duration-200 ease-out',
          className,
        )}
        style={gridStyle}
      >
        {hasLeftSidebar ? (
          <aside
            className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background"
            style={{ gridArea: 'left' }}
          >
            {leftSidebar}
          </aside>
        ) : null}
        {hasLeftSidebar ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="resize left sidebar"
            tabIndex={0}
            onMouseDown={startDrag('left')}
            onKeyDown={onLeftKeyDown}
            className="group relative cursor-col-resize select-none"
            style={{ gridArea: 'lhandle' }}
          >
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-border-soft to-transparent transition-colors group-hover:via-border group-focus-visible:via-primary" />
          </div>
        ) : null}
        <main
          className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background"
          style={{ gridArea: 'main' }}
        >
          {main}
        </main>
        {hasRightSidebar ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="resize right sidebar"
            tabIndex={rightSidebarCollapsed ? -1 : 0}
            onMouseDown={rightSidebarCollapsed ? undefined : startDrag('right')}
            onKeyDown={rightSidebarCollapsed ? undefined : onRightKeyDown}
            className={cn(
              'group relative select-none overflow-hidden',
              rightSidebarCollapsed ? 'pointer-events-none' : 'cursor-col-resize',
            )}
            style={{ gridArea: 'rhandle' }}
          >
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-border-soft to-transparent transition-colors group-hover:via-border group-focus-visible:via-primary" />
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
      </div>
    </div>
  );
};
