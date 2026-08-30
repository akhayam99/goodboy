import { useCallback } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useCurrentWorkspace, useSessions } from '../../../../store';
import { SessionActivityBar } from '../../../workspace/components/SessionActivityBar';
import { BoardCta } from './parts/BoardCta';
import { SidebarHeader } from './parts/SidebarHeader';

type Props = {
  readonly session: Session;
  readonly onNavigate?: () => void;
  readonly onCollapse?: () => void;
  readonly collapseAction?: 'collapse' | 'pin';
};

export const SessionNavSidebar = ({
  session,
  onNavigate,
  onCollapse,
  collapseAction = 'collapse',
}: Props) => {
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const archivedSessions = useAppStore((s) =>
    currentWorkspace ? (s.archivedSessions[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<Session>;
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions);

  const onSelectSession = useCallback(
    (id: SessionId) => {
      void setCurrentSession(id);
      onNavigate?.();
    },
    [onNavigate, setCurrentSession],
  );

  const onArchivedTabOpen = useCallback(() => {
    if (!currentWorkspace) {
      return;
    }
    void loadArchivedSessions(currentWorkspace.id);
  }, [currentWorkspace, loadArchivedSessions]);

  const onBoard = useCallback(() => {
    void setCurrentSession(null);
    onNavigate?.();
  }, [onNavigate, setCurrentSession]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-2 px-2 pb-1.5 pt-2">
        {onCollapse ? <SidebarHeader onCollapse={onCollapse} action={collapseAction} /> : null}
        <BoardCta onNavigate={onBoard} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-x-clip">
        <div className="flex min-h-0 flex-1">
          {currentWorkspace ? (
            <SessionActivityBar
              workspaceId={currentWorkspace.id}
              sessions={sessions}
              archivedSessions={archivedSessions}
              currentSessionId={session.id}
              onSelectSession={onSelectSession}
              onArchivedTabOpen={onArchivedTabOpen}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
