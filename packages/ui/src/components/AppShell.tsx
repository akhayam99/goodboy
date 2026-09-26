import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../cn';
import { SHEET_CLASSES, type ResizeActivity } from '../sheet';
import { DrawerColumn } from './DrawerColumn';
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
}: LayoutParams): Layout => {
  const rows = hasFooter ? 'minmax(0,1fr) auto' : 'minmax(0,1fr)';
  if (!hasLeftSidebar) {
    return {
      templateAreas: hasFooter ? '"main" "footer"' : '"main"',
      templateColumns: 'minmax(0,1fr)',
      templateRows: rows,
    };
  }
  const leftCol = `${leftColumnWidth({ leftCollapsed, leftHidden, leftWidthPx })}px`;
  const handleCol = leftHidden || leftCollapsed ? '0px' : `${HANDLE_WIDTH}px`;
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
  drawer,
  studio,
  className,
}: AppShellProps) => {
  const hasFooter = footer != null;
  const hasLeftSidebar = leftSidebar != null;
  const isLeftResizeDisabled = leftHidden || leftSidebarCollapsed;
  const [leftWidth, setLeftWidth] = useState<number>(readPersistedLeftWidth);
  const [leftResize, setLeftResize] = useState<ResizeActivity>('idle');
  const isSheetWrapped = hasLeftSidebar && !leftHidden;

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
  const gridStyle = {
    gridTemplateAreas: layout.templateAreas,
    gridTemplateColumns: layout.templateColumns,
    gridTemplateRows: layout.templateRows,
  } satisfies CSSProperties;

  return (
    <div className="flex h-screen w-screen flex-col bg-chrome">
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
          <DrawerColumn
            main={main}
            drawer={drawer ?? null}
            ariaLabel="Side panel"
            resizeLabel="Resize side panel"
          />
        </main>
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
