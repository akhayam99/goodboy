import type { ReactNode } from 'react';

export interface AppShellProps {
  header: ReactNode;
  leftSidebar: ReactNode;
  main: ReactNode;
  rightSidebar: ReactNode;
}

export function AppShell({ header, leftSidebar, main, rightSidebar }: AppShellProps) {
  return (
    <div className="grid h-screen grid-rows-[auto_1fr] bg-background text-foreground">
      <header className="flex h-9 items-center border-b border-border px-3 text-sm">
        {header}
      </header>
      <div className="grid grid-cols-[260px_minmax(0,1fr)_320px] overflow-hidden">
        <aside className="overflow-y-auto border-r border-border">{leftSidebar}</aside>
        <main className="overflow-y-auto">{main}</main>
        <aside className="overflow-y-auto border-l border-border">{rightSidebar}</aside>
      </div>
    </div>
  );
}
