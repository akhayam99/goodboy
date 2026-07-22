import { useCallback, useState } from 'react';
import { Kanban } from 'lucide-react';
import { KbdPill } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
} from '../../../../store';
import { WorkspaceLinkDialog } from '../WorkspaceLinkDialog';
import { SessionActivityBar } from '../SessionActivityBar';
import { NoWorkspaceEmpty } from './parts/NoWorkspaceEmpty';
import { SessionsRail } from './parts/SessionsRail';

export const WorkspacesSidebar = () => {
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  const currentSession = useCurrentSession();
  const sessionsSidebarCollapsed = useAppStore((s) => s.sessionsSidebarCollapsed);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const onSelectSession = useCallback(
    (id: SessionId) => {
      void setCurrentSession(id);
    },
    [setCurrentSession],
  );
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);

  const archivedSessions = useAppStore((s) =>
    currentWorkspace ? (s.archivedSessions[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<Session>;
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions);
  const onArchivedTabOpen = useCallback(() => {
    if (!currentWorkspace) {
      return;
    }
    void loadArchivedSessions(currentWorkspace.id);
  }, [currentWorkspace, loadArchivedSessions]);

  if (sessionsSidebarCollapsed && currentSession != null) {
    return <SessionsRail />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {currentWorkspace && currentSession ? (
        <div className="shrink-0 px-2 pt-2 pb-1">
          <button
            type="button"
            onClick={() => void setCurrentSession(null)}
            aria-label="back to board"
            className="group relative w-full flex items-center justify-center gap-1.5 rounded-md bg-accent/10 px-2 py-1.5 text-xs font-semibold text-accent ring-1 ring-accent/20 motion-safe:transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <Kanban size={14} aria-hidden />
            Board
            <KbdPill
              aria-hidden
              className="pointer-events-none absolute right-2 top-1/2 h-4 min-w-4 -translate-y-1/2 px-1 text-[9px] opacity-0 transition-opacity group-hover:opacity-100"
            >
              ⌘⇧⎋
            </KbdPill>
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {!currentWorkspace ? (
          <NoWorkspaceEmpty onAddWorkspace={() => setAddWorkspaceOpen(true)} />
        ) : (
          <SessionActivityBar
            workspaceId={currentWorkspace.id}
            sessions={sessions}
            archivedSessions={archivedSessions}
            currentSessionId={currentSession?.id ?? null}
            onSelectSession={onSelectSession}
            onNewSession={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
            onArchivedTabOpen={onArchivedTabOpen}
          />
        )}
      </div>

      {addWorkspaceOpen ? (
        <WorkspaceLinkDialog open onClose={() => setAddWorkspaceOpen(false)} />
      ) : null}
    </div>
  );
};
