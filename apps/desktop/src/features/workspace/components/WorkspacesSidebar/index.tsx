import { useCallback, useState } from 'react';
import { Divider } from '@goodboy/ui';
import { ArrowLeft } from 'lucide-react';
import type { Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
} from '../../../../store';
import { WorkspaceHeader } from '../WorkspaceHeader';
import { WorkspaceLinkDialog } from '../WorkspaceLinkDialog';
import { SessionActivityBar } from '../SessionActivityBar';
import { NoWorkspaceEmpty } from './parts/NoWorkspaceEmpty';

export const WorkspacesSidebar = () => {
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  const currentSession = useCurrentSession();
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {currentWorkspace ? (
        <>
          <WorkspaceHeader />
          <Divider />
        </>
      ) : null}

      {currentWorkspace && currentSession ? (
        <button
          type="button"
          onClick={() => void setCurrentSession(null)}
          aria-label="back to board"
          className="mx-2 mb-1 mt-2 inline-flex shrink-0 items-center gap-1.5 self-start rounded-md px-2 py-1.5 text-xs font-semibold text-foreground motion-safe:transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <ArrowLeft size={14} aria-hidden />
          Back to board
        </button>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {!currentWorkspace ? (
          <NoWorkspaceEmpty onAddWorkspace={() => setAddWorkspaceOpen(true)} />
        ) : currentSession ? (
          <SessionActivityBar
            workspaceId={currentWorkspace.id}
            sessions={sessions}
            archivedSessions={archivedSessions}
            currentSessionId={currentSession.id}
            onSelectSession={onSelectSession}
            onNewSession={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
            onArchivedTabOpen={onArchivedTabOpen}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <p className="text-xs text-muted-foreground">
              select a session from the board to see its activity
            </p>
          </div>
        )}
      </div>

      {addWorkspaceOpen ? (
        <WorkspaceLinkDialog open onClose={() => setAddWorkspaceOpen(false)} />
      ) : null}
    </div>
  );
};
