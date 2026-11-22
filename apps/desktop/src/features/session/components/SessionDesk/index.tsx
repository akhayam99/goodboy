import type { Session } from '@goodboy/types';
import { WorkTimeProvider } from '../../../workTreeModel/WorkTimeProvider';
import { DeskBody } from './DeskBody';

type Props = {
  readonly session: Session;
};

export const SessionDesk = ({ session }: Props) => (
  <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
    <DeskBody session={session} />
  </WorkTimeProvider>
);
