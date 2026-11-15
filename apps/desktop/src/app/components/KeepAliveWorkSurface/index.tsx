import { Activity } from 'react';
import type { SessionId } from '@goodboy/types';
import { SessionWorkspace } from '../../../features/session/components/SessionWorkspace';
import { SessionHeadContext } from '../../../features/session/sessionHeadContext';
import { useSessionById } from '../../../store';
import { useGoToBoard } from '../../hooks/useGoToBoard';
import { PanelBoundary } from '../PanelBoundary';
import { SessionHead } from '../SessionHead';

type KeepAliveWorkSurfaceProps = {
  readonly sessionId: SessionId;
  readonly isActive: boolean;
};

export const KeepAliveWorkSurface = ({ sessionId, isActive }: KeepAliveWorkSurfaceProps) => {
  const session = useSessionById(sessionId);
  const goToBoard = useGoToBoard();
  if (!session) {
    return null;
  }
  return (
    <Activity mode={isActive ? 'visible' : 'hidden'}>
      <div className="absolute inset-0" data-browser-session={sessionId}>
        <PanelBoundary leaveLabel="Open board" onLeave={goToBoard}>
          <SessionHeadContext.Provider value={SessionHead}>
            <SessionWorkspace session={session} />
          </SessionHeadContext.Provider>
        </PanelBoundary>
      </div>
    </Activity>
  );
};
