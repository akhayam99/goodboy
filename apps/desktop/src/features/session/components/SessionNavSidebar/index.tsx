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
import { SessionRowsSkeleton } from './SessionRowsSkeleton';

type Props = {
  readonly currentSessionId: SessionId | null;
  readonly isStudioOver?: boolean;
  readonly onNavigate?: () => void;
};

export const SessionNavSidebar = ({
  currentSessionId,
  isStudioOver = false,
  onNavigate,
}: Props) => {
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  const navigate = useAppStore((s) => s.navigate);
  const archivedSessions = useAppStore((s) =>
    currentWorkspace ? (s.archivedSessions[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<Session>;
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions);
  const isBoardReady = useAppStore((s) => s.boardReady);

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
    void loadArchivedSessions({ workspaceId: currentWorkspace.id });
  }, [currentWorkspace, loadArchivedSessions]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-x-clip">
        <div className="flex min-h-0 flex-1">
          {currentWorkspace !== null && !isBoardReady ? <SessionRowsSkeleton /> : null}
          {currentWorkspace !== null && isBoardReady ? (
            <SessionActivityBar
              workspaceId={currentWorkspace.id}
              sessions={sessions}
              archivedSessions={archivedSessions}
              currentSessionId={currentSessionId}
              isStudioOver={isStudioOver}
              onSelectSession={onSelectSession}
              onArchivedTabOpen={onArchivedTabOpen}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
