import type { SessionId } from '@goodboy/types';
import { SessionWorkspace } from '../../../features/session/components/SessionWorkspace';
import { useSessionById } from '../../../store';

type KeepAliveWorkSurfaceProps = {
  readonly sessionId: SessionId;
  readonly isActive: boolean;
};

export function KeepAliveWorkSurface({ sessionId, isActive }: KeepAliveWorkSurfaceProps) {
  const session = useSessionById(sessionId);
  if (!session) {
    return null;
  }
  return (
    <div hidden={!isActive} className="absolute inset-0">
      <SessionWorkspace session={session} isActive={isActive} />
    </div>
  );
}
