import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../cn';

export interface AppShellProps {
  leftSidebar: ReactNode;
  main: ReactNode;
  rightSidebar: ReactNode;
  rightSidebarCollapsed?: boolean;
  className?: string;
}

const LEFT_SIDEBAR_WIDTH = '280px';
const RIGHT_SIDEBAR_WIDTH = '340px';
const RIGHT_RAIL_WIDTH = '40px';

function buildLayout(opts: { collapsed: boolean; hasRightSidebar: boolean }): {
  templateAreas: string;
  templateColumns: string;
} {
  const { collapsed, hasRightSidebar } = opts;
  const rightColWidth = collapsed ? RIGHT_RAIL_WIDTH : RIGHT_SIDEBAR_WIDTH;
  const templateColumns = hasRightSidebar
    ? `${LEFT_SIDEBAR_WIDTH} minmax(0,1fr) ${rightColWidth}`
    : `${LEFT_SIDEBAR_WIDTH} minmax(0,1fr)`;
  const templateAreas = hasRightSidebar ? `"left main right"` : `"left main"`;
  return { templateAreas, templateColumns };
}

export function AppShell({
  leftSidebar,
  main,
  rightSidebar,
  rightSidebarCollapsed = false,
  className,
}: AppShellProps) {
  const hasRightSidebar = rightSidebar !== null && rightSidebar !== undefined;
  const layout = buildLayout({ collapsed: rightSidebarCollapsed, hasRightSidebar });
  const gridStyle: CSSProperties = {
    gridTemplateAreas: layout.templateAreas,
    gridTemplateColumns: layout.templateColumns,
    gridTemplateRows: 'minmax(0,1fr)',
  };

  return (
    <div className="h-screen w-screen bg-background">
      <div
        className={cn(
          'grid h-full w-full overflow-hidden text-foreground',
          'motion-safe:[transition:grid-template-columns_var(--motion-normal,200ms)_var(--ease-emphasized,cubic-bezier(0.2,0,0,1))]',
          className,
        )}
        style={gridStyle}
      >
        <aside
          className="m-3 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-subtle shadow-sm"
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
      </div>
    </div>
  );
}
