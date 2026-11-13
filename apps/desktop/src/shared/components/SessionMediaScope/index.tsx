import type { ReactNode } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { ToolImageScope } from '../ToolImageScope';

type Props = {
  readonly sessionId: SessionId | null;
  readonly children: ReactNode;
};

export const SessionMediaScope = ({ sessionId, children }: Props) => {
  const workspaceId = useAppStore((state) =>
    sessionId === null ? undefined : sessionById(state.sessions, sessionId)?.workspaceId,
  );
  if (workspaceId === undefined) {
    return <>{children}</>;
  }
  return (
    <ToolImageScope workspaceId={workspaceId} provider="github">
      {children}
    </ToolImageScope>
  );
};
