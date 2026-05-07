import type { ReactNode } from 'react';

export interface AppShellProps {
  header: ReactNode;
  leftSidebar: ReactNode;
  main: ReactNode;
  rightSidebar: ReactNode;
  footer?: ReactNode;
  rightSidebarCollapsed?: boolean;
}

export function AppShell({
  header,
  leftSidebar,
  main,
  rightSidebar,
  footer,
  rightSidebarCollapsed = false,
}: AppShellProps) {
  const gridCols = rightSidebarCollapsed
    ? 'grid-cols-[260px_minmax(0,1fr)]'
    : 'grid-cols-[260px_minmax(0,1fr)_320px]';
  return (
    <div
      className={`grid h-screen ${footer ? 'grid-rows-[auto_1fr_auto]' : 'grid-rows-[auto_1fr]'} bg-background text-foreground`}
    >
      <header className="flex h-9 items-center border-b border-border px-3 text-sm">
        {header}
      </header>
      <div className={`grid ${gridCols} overflow-hidden`}>
        <aside className="overflow-y-auto border-r border-border bg-subtle">{leftSidebar}</aside>
        <main className="overflow-y-auto">{main}</main>
        {rightSidebarCollapsed ? null : (
          <aside className="overflow-y-auto border-l border-border">{rightSidebar}</aside>
        )}
      </div>
      {footer ? (
        <footer className="flex h-6 items-center border-t border-border bg-subtle px-3 font-mono text-[11px] text-muted-foreground">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
