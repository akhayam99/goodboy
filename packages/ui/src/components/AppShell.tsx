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

const LEFT_SIDEBAR_WIDTH = '260px';
const RIGHT_SIDEBAR_WIDTH = '320px';

function buildLayout(opts: { collapsed: boolean; hasFooter: boolean }): {
  templateAreas: string;
  templateColumns: string;
  templateRows: string;
} {
  const { collapsed, hasFooter } = opts;
  const templateColumns = collapsed
    ? `${LEFT_SIDEBAR_WIDTH} minmax(0,1fr)`
    : `${LEFT_SIDEBAR_WIDTH} minmax(0,1fr) ${RIGHT_SIDEBAR_WIDTH}`;
  if (hasFooter) {
    const templateAreas = collapsed
      ? `"header header" "left main" "footer footer"`
      : `"header header header" "left main right" "footer footer footer"`;
    return { templateAreas, templateColumns, templateRows: 'auto minmax(0,1fr) auto' };
  }
  const templateAreas = collapsed
    ? `"header header" "left main"`
    : `"header header header" "left main right"`;
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
  const layout = buildLayout({ collapsed: rightSidebarCollapsed, hasFooter: Boolean(footer) });
  const gridStyle: CSSProperties = {
    gridTemplateAreas: layout.templateAreas,
    gridTemplateColumns: layout.templateColumns,
    gridTemplateRows: layout.templateRows,
  };

  return (
    <div className="h-screen w-screen bg-muted/40">
      <div
        className={cn(
          'grid h-full w-full overflow-hidden border-border-soft bg-background text-foreground',
          className,
        )}
        style={gridStyle}
      >
        <header
          className="flex h-9 min-w-0 items-center border-b border-border bg-background px-3 text-sm"
          style={{ gridArea: 'header' }}
        >
          {header}
        </header>
        <aside
          className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-border bg-subtle"
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
        {rightSidebarCollapsed ? null : (
          <aside
            className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-background"
            style={{ gridArea: 'right' }}
          >
            {rightSidebar}
          </aside>
        )}
        {footer ? (
          <footer
            className="flex h-6 min-w-0 items-center border-t border-border bg-subtle px-3 font-mono text-[11px] text-muted-foreground"
            style={{ gridArea: 'footer' }}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
