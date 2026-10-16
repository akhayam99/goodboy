import type { ReactNode } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { WorkTimeProvider } from '../../../workTreeModel/components/WorkTimeProvider';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly children: ReactNode;
};

export const RunWorkTime = ({ sessionId, workspaceId, children }: Props) => (
  <WorkTimeProvider sessionId={sessionId} workspaceId={workspaceId}>
    {children}
  </WorkTimeProvider>
);
