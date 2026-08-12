import { useCallback } from 'react';
import { cn, Divider } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useCurrentWorkspace, useSessions } from '../../../../store';
import { SessionActivityBar } from '../../../workspace/components/SessionActivityBar';
import type { SessionNavMode } from '../../../workspace/hooks/useSessionNavMode';
import { useLensNavModel } from '../../hooks/useLensNavModel';
import { LensNav } from './parts/LensNav';
import { BoardCta } from './parts/BoardCta';
import { SessionBackRow } from './parts/SessionBackRow';
import { SidebarHeader } from './parts/SidebarHeader';

type Props = {
  readonly session: Session;
  readonly mode: SessionNavMode;
  readonly onModeChange: (mode: SessionNavMode) => void;
  readonly onNavigate?: () => void;
  readonly onCollapse?: () => void;
};

export const SessionNavSidebar = ({
  session,
  mode,
  onModeChange,
  onNavigate,
  onCollapse,
}: Props) => {
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const archivedSessions = useAppStore((s) =>
    currentWorkspace ? (s.archivedSessions[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<Session>;
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions);
  const lensNavModel = useLensNavModel({ session, isActive: true });

  const onSelectSession = useCallback(
    (id: SessionId) => {
      void setCurrentSession(id);
      onModeChange('lenses');
      onNavigate?.();
    },
    [onModeChange, onNavigate, setCurrentSession],
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
        {onCollapse ? <SidebarHeader onCollapse={onCollapse} /> : null}
        <BoardCta onNavigate={onBoard} />
        {mode === 'lenses' ? (
          <>
            <Divider className="mx-1 opacity-60" />
            <SessionBackRow title={session.goal} onBack={() => onModeChange('sessions')} />
          </>
        ) : null}
      </div>
      <Divider />
      <div
        key={mode}
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-x-clip',
          mode === 'sessions'
            ? 'motion-safe:animate-nav-step-out'
            : 'motion-safe:animate-nav-step-in',
        )}
      >
        {mode === 'sessions' ? (
          <div className="flex min-h-0 flex-1">
            {currentWorkspace ? (
              <SessionActivityBar
                workspaceId={currentWorkspace.id}
                sessions={sessions}
                archivedSessions={archivedSessions}
                currentSessionId={session.id}
                onSelectSession={onSelectSession}
                onNewSession={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
                onArchivedTabOpen={onArchivedTabOpen}
              />
            ) : null}
          </div>
        ) : (
          <LensNav
            session={session}
            filesCount={lensNavModel.filesCount}
            diffstat={lensNavModel.diffstat}
            isBranchless={lensNavModel.isBranchless}
          />
        )}
      </div>
    </div>
  );
};
