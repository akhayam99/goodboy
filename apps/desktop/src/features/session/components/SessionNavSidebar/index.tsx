import { useCallback } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentWorkspace,
  useSessions,
  sessionPlace,
} from '../../../../store';
import { SessionActivityBar } from '../../../workspace/components/SessionActivityBar';
import { SidebarToggleButton } from './parts/SidebarToggleButton';

type Props = {
  readonly session: Session;
  readonly onNavigate?: () => void;
  readonly isCollapsed?: boolean;
  readonly onToggleSidebar?: () => void;
};

export const SessionNavSidebar = ({
  session,
  onNavigate,
  isCollapsed = false,
  onToggleSidebar,
}: Props) => {
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  const navigate = useAppStore((s) => s.navigate);
  const archivedSessions = useAppStore((s) =>
    currentWorkspace ? (s.archivedSessions[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<Session>;
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions);

  const onSelectSession = useCallback(
    (id: SessionId) => {
      navigate({ to: sessionPlace({ sessionId: id }) });
      onNavigate?.();
    },
    [onNavigate, navigate],
  );

  const onArchivedTabOpen = useCallback(() => {
    if (!currentWorkspace) {
      return;
    }
    void loadArchivedSessions(currentWorkspace.id);
  }, [currentWorkspace, loadArchivedSessions]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {onToggleSidebar !== undefined ? (
        <div className="flex shrink-0 items-center gap-2 pb-1.5 pl-1.5 pr-2 pt-2">
          <SidebarToggleButton isCollapsed={isCollapsed} onToggle={onToggleSidebar} />
        </div>
      ) : null}
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
