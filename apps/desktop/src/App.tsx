import { useEffect } from 'react';
import { AppShell, KbdPill, ScrollArea } from '@kay-am/ui';
import { ChatView } from './components/chat/ChatView';
import { SessionsSidebar } from './components/SessionsSidebar';
import { TelemetryPill } from './components/TelemetryPill';
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
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {!providerAvailable ? (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-danger">
                claude cli missing
              </span>
            ) : null}
            <TelemetryPill />
            <span>
              press <KbdPill>⌘K</KbdPill>
            </span>
          </div>
        </div>
      }
      leftSidebar={<SessionsSidebar />}
      main={
        !hydrated ? (
          <p className="p-6 text-sm text-muted-foreground">loading…</p>
        ) : error ? (
          <p className="p-6 text-sm text-danger">init error: {error}</p>
        ) : currentSession ? (
          <ChatView session={currentSession} />
        ) : (
          <div className="flex h-full flex-col p-6">
            <p className="text-sm text-muted-foreground">
              {currentWorkspace
                ? 'create a session from the sidebar to begin.'
                : 'no workspace selected. open the dropdown to add one.'}
            </p>
          </div>
        )
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
