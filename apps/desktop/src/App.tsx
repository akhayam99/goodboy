import { useEffect } from 'react';
import { AppShell, KbdPill, ScrollArea } from '@kay-am/ui';
import { SessionsSidebar } from './components/SessionsSidebar';
import { WorkspaceSelector } from './components/WorkspaceSelector';
import { useAppStore, useCurrentSession, useCurrentWorkspace, useProviderAvailable } from './store';

export function App() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const error = useAppStore((s) => s.error);
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const providerAvailable = useProviderAvailable();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <AppShell
      header={
        <div className="flex w-full items-center gap-3">
          <span className="font-semibold tracking-tight">kAY.am</span>
          <WorkspaceSelector />
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {!providerAvailable ? (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-danger">
                claude cli missing
              </span>
            ) : null}
            press <KbdPill>⌘K</KbdPill>
          </span>
        </div>
      }
      leftSidebar={<SessionsSidebar />}
      main={
        <div className="flex h-full flex-col gap-4 p-6">
          {!hydrated ? (
            <p className="text-sm text-muted-foreground">loading…</p>
          ) : error ? (
            <p className="text-sm text-danger">init error: {error}</p>
          ) : currentSession ? (
            <>
              <h1 className="text-lg font-medium tracking-tight">{currentSession.goal}</h1>
              <p className="text-xs text-muted-foreground">
                state: {currentSession.state.kind} · chat view in #21
              </p>
            </>
          ) : currentWorkspace ? (
            <p className="text-sm text-muted-foreground">
              create a session from the sidebar to begin.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              no workspace selected. open the dropdown to add one.
            </p>
          )}
        </div>
      }
      rightSidebar={
        <ScrollArea className="h-full p-2">
          <div className="text-xs uppercase text-muted-foreground">context</div>
          <p className="mt-2 text-sm text-muted-foreground">slots will live here.</p>
        </ScrollArea>
      }
    />
  );
}
