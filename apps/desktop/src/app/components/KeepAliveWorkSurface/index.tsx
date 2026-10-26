import type { SessionId } from '@goodboy/types';
import { SessionWorkspace } from '../../../features/session/components/SessionWorkspace';
import { useSessionById } from '../../../store';
import { useGoToBoard } from '../../hooks/useGoToBoard';
import { PanelBoundary } from '../PanelBoundary';

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
    <div hidden={!isActive} className="absolute inset-0">
      <PanelBoundary leaveLabel="Go to the board" onLeave={goToBoard}>
        <SessionWorkspace session={session} isActive={isActive} />
      </PanelBoundary>
    </div>
  );
};
