import { useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../cn';
import { SHEET_CLASSES, type ResizeActivity } from '../sheet';
import { DrawerColumn } from './DrawerColumn';
import type { DrawerSizing } from '../drawerGeometry';
import { ResizeHandle } from './ResizeHandle';
import { useResizableWidth } from '../useResizableWidth';

export type AppShellProps = {
  readonly topBar?: ReactNode;
  readonly footer?: ReactNode;
  readonly leftSidebar?: ReactNode;
  readonly leftHidden?: boolean;
  readonly leftSidebarCollapsed?: boolean;
  readonly leftOverlay?: ReactNode;
  readonly main: ReactNode;
  readonly drawer?: ReactNode;
  readonly drawerSizing?: DrawerSizing;
  readonly studio?: ReactNode;
  readonly className?: string;
};

export const LEFT_SIDEBAR_MIN = 260;
export const LEFT_SIDEBAR_MAX = 640;
export const LEFT_SIDEBAR_DEFAULT = 340;
export const LEFT_SIDEBAR_STORAGE_KEY = 'goodboy:left-sidebar-width:v2';

export const COLLAPSED_RAIL_WIDTH = 44;

const HANDLE_WIDTH = 6;

const LEFT_WIDTH_VAR = '--goodboy-left-sidebar-width';

type LayoutParams = {
  readonly leftCollapsed: boolean;
  readonly leftHidden: boolean;
  readonly hasLeftSidebar: boolean;
  readonly hasFooter: boolean;
};

type Layout = {
  readonly templateAreas: string;
  readonly templateColumns: string;
  readonly templateRows: string;
};

const leftColumnWidth = ({
  leftCollapsed,
  leftHidden,
}: Pick<LayoutParams, 'leftCollapsed' | 'leftHidden'>): string => {
  if (leftHidden) {
    return '0px';
  }
  if (leftCollapsed) {
    return `${COLLAPSED_RAIL_WIDTH}px`;
  }
  return `var(${LEFT_WIDTH_VAR})`;
};

const buildLayout = ({
  leftCollapsed,
  leftHidden,
  hasLeftSidebar,
  hasFooter,
}: LayoutParams): Layout => {
  const rows = hasFooter ? 'minmax(0,1fr) auto' : 'minmax(0,1fr)';
  if (!hasLeftSidebar) {
    return {
      templateAreas: hasFooter ? '"main" "footer"' : '"main"',
      templateColumns: 'minmax(0,1fr)',
      templateRows: rows,
    };
  }
  const leftCol = leftColumnWidth({ leftCollapsed, leftHidden });
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
  drawerSizing,
  studio,
  className,
}: AppShellProps) => {
  const hasFooter = footer != null;
  const hasLeftSidebar = leftSidebar != null;
  const isLeftResizeDisabled = leftHidden || leftSidebarCollapsed;
  const left = useResizableWidth<HTMLDivElement>({
    storageKey: LEFT_SIDEBAR_STORAGE_KEY,
    defaultWidth: LEFT_SIDEBAR_DEFAULT,
    min: LEFT_SIDEBAR_MIN,
    max: LEFT_SIDEBAR_MAX,
    cssVar: LEFT_WIDTH_VAR,
  });
  const [leftResize, setLeftResize] = useState<ResizeActivity>('idle');
  const isSheetWrapped = hasLeftSidebar && !leftHidden;

  const layout = buildLayout({
    leftCollapsed: leftSidebarCollapsed,
    leftHidden,
    hasLeftSidebar,
    hasFooter,
  });
  const gridStyle = {
    ...left.style,
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
        ref={left.targetRef}
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
                {...left.handleProps}
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
            sizing={drawerSizing}
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
