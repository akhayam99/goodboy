import type { ReactNode } from 'react';
import type { Session } from '@goodboy/types';
import { WorkTimeProvider } from '../../workTreeModel/WorkTimeProvider';

type Props = {
  readonly session: Session;
  readonly children: ReactNode;
};

export const AutoWorkTime = ({ session, children }: Props) => (
  <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
    {children}
  </WorkTimeProvider>
);
