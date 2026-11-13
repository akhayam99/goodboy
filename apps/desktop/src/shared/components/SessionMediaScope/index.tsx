import type { ReactNode } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { useSessionRepo } from '../../../store/slices/worktrees/useSessionRepo';
import { ToolImageScope } from '../ToolImageScope';

type Props = {
  readonly sessionId: SessionId | null;
  readonly mountId?: MountId | null;
  readonly children: ReactNode;
};

export const SessionMediaScope = ({ sessionId, mountId = null, children }: Props) => {
  const workspaceId = useAppStore((state) =>
    sessionId === null ? undefined : sessionById(state.sessions, sessionId)?.workspaceId,
  );
  const repo = useSessionRepo({ sessionId, mountId });
  if (workspaceId === undefined) {
    return <>{children}</>;
  }
  return (
    <ToolImageScope workspaceId={workspaceId} projectId={repo?.projectId ?? null} provider="github">
      {children}
    </ToolImageScope>
  );
};
