import { PaneShell } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { WorkTimeProvider } from '../../../workTreeModel/WorkTimeProvider';
import { CentralColumn } from './CentralColumn';
import { EmptySessionStart } from './EmptySessionStart';
import { FolderCard } from './FolderCard';
import { HeaderBand } from './HeaderBand';
import { OverviewTitle } from './OverviewTitle';
import { OverviewHeaderActions } from './OverviewHeaderActions';
import { OverviewNotices } from './OverviewNotices';
import { UnassignedNotes } from './UnassignedNotes';

type Props = {
  readonly session: Session;
};

export const SessionOverviewPane = ({ session }: Props) => {
  const sessionId: SessionId = session.id;
  const isArchived = session.archivedAt != null;

  return (
    <PaneShell
      page="overview"
      title={<OverviewTitle session={session} />}
      actions={<OverviewHeaderActions session={session} />}
      headerRhythm="section"
      animationClassName="animate-fade-in"
    >
      <HeaderBand session={session} />
      {isArchived ? null : <OverviewNotices session={session} />}
      {isArchived ? null : <UnassignedNotes sessionId={sessionId} />}
      <EmptySessionStart session={session} />
      {isArchived ? null : <FolderCard sessionId={sessionId} />}
      <WorkTimeProvider sessionId={sessionId} workspaceId={session.workspaceId}>
        <CentralColumn session={session} />
      </WorkTimeProvider>
    </PaneShell>
  );
};
