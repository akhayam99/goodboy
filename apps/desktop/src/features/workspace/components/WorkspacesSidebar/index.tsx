import { useCallback, useState } from 'react';
import { Divider } from '@goodboy/ui';
import { PanelLeftClose } from 'lucide-react';
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
import { FOOTER_ICON_BTN } from './lib';
import { CollapsedSidebarRail } from './parts/CollapsedSidebarRail';
import { NoWorkspaceEmpty } from './parts/NoWorkspaceEmpty';

type WorkspacesSidebarProps = {
  collapsed?: boolean;
  onToggleCollapse: () => void;
};

export const WorkspacesSidebar = ({
  collapsed = false,
  onToggleCollapse,
}: WorkspacesSidebarProps) => {
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

  if (collapsed) {
    return <CollapsedSidebarRail onExpand={onToggleCollapse} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {currentWorkspace ? (
        <>
          <WorkspaceHeader />
          <Divider />
        </>
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

      <Divider />
      <div className="flex shrink-0 items-center gap-0.5 px-2.5 py-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="collapse sidebar (⌘B)"
          aria-label="collapse sidebar"
          className={FOOTER_ICON_BTN}
        >
          <PanelLeftClose size={14} aria-hidden />
        </button>
      </div>

      {addWorkspaceOpen ? (
        <WorkspaceLinkDialog open onClose={() => setAddWorkspaceOpen(false)} />
      ) : null}
    </div>
  );
};
