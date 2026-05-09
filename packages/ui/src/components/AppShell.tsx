import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../cn';

export interface AppShellProps {
  header: ReactNode;
  leftSidebar: ReactNode;
  main: ReactNode;
  rightSidebar: ReactNode;
  footer?: ReactNode;
  rightSidebarCollapsed?: boolean;
  className?: string;
}

const LEFT_SIDEBAR_WIDTH = '280px';
const RIGHT_SIDEBAR_WIDTH = '340px';
const RIGHT_RAIL_WIDTH = '40px';

function buildLayout(opts: { collapsed: boolean; hasRightSidebar: boolean; hasFooter: boolean }): {
  templateAreas: string;
  templateColumns: string;
  templateRows: string;
} {
  const { collapsed, hasRightSidebar, hasFooter } = opts;
  const hasRight = hasRightSidebar;
  const rightColWidth = collapsed ? RIGHT_RAIL_WIDTH : RIGHT_SIDEBAR_WIDTH;
  const templateColumns = hasRight
    ? `${LEFT_SIDEBAR_WIDTH} minmax(0,1fr) ${rightColWidth}`
    : `${LEFT_SIDEBAR_WIDTH} minmax(0,1fr)`;
  if (hasFooter) {
    const templateAreas = hasRight
      ? `"header header header" "left main right" "footer footer footer"`
      : `"header header" "left main" "footer footer"`;
    return { templateAreas, templateColumns, templateRows: 'auto minmax(0,1fr) auto' };
  }
  const templateAreas = hasRight
    ? `"header header header" "left main right"`
    : `"header header" "left main"`;
  return { templateAreas, templateColumns, templateRows: 'auto minmax(0,1fr)' };
}

export function AppShell({
  header,
  leftSidebar,
  main,
  rightSidebar,
  footer,
  rightSidebarCollapsed = false,
  className,
}: AppShellProps) {
  const hasRightSidebar = rightSidebar !== null && rightSidebar !== undefined;
  const layout = buildLayout({
    collapsed: rightSidebarCollapsed,
    hasRightSidebar,
    hasFooter: Boolean(footer),
  });
  const gridStyle: CSSProperties = {
    gridTemplateAreas: layout.templateAreas,
    gridTemplateColumns: layout.templateColumns,
    gridTemplateRows: layout.templateRows,
  };

  return (
    <div className="h-screen w-screen bg-muted/40">
      <div
        className={cn(
          'grid h-full w-full overflow-hidden bg-background text-foreground',
          'motion-safe:[transition:grid-template-columns_var(--motion-normal,200ms)_var(--ease-emphasized,cubic-bezier(0.2,0,0,1))]',
          className,
        )}
        style={gridStyle}
      >
        <header
          className="flex h-11 min-w-0 items-center bg-subtle px-4 text-sm"
          style={{ gridArea: 'header' }}
        >
          {header}
        </header>
        <aside
          className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-subtle"
          style={{ gridArea: 'left' }}
        >
          {leftSidebar}
        </aside>
        <main
          className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background"
          style={{ gridArea: 'main' }}
        >
          {main}
        </main>
        {hasRightSidebar ? (
          <aside
            className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background"
            style={{ gridArea: 'right' }}
          >
            {rightSidebar}
          </aside>
        ) : null}
        {footer ? (
          <footer
            className="flex h-7 min-w-0 items-center bg-subtle px-4 font-mono text-xs text-muted-foreground"
            style={{ gridArea: 'footer' }}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
