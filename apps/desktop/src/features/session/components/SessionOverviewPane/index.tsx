import { PaneShell } from '@goodboy/ui';
import { useCallback, useState } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { WorkTimeProvider } from '../../../workTreeModel/WorkTimeProvider';
import { CentralColumn } from './CentralColumn';
import { FolderCard } from './FolderCard';
import { HeaderBand } from './HeaderBand';
import { OverviewTitle } from './OverviewTitle';
import { OverviewHeaderActions } from './OverviewHeaderActions';
import { OverviewNotices } from './OverviewNotices';
import { UnassignedNotes } from './UnassignedNotes';

type Props = {
  readonly session: Session;
};

type LeadChange = {
  readonly hasLead: boolean;
};

export const SessionOverviewPane = ({ session }: Props) => {
  const sessionId: SessionId = session.id;
  const [hasNextLead, setHasNextLead] = useState(false);
  const onLeadChange = useCallback(({ hasLead }: LeadChange) => setHasNextLead(hasLead), []);
  const isArchived = session.archivedAt != null;

  return (
    <PaneShell
      page="overview"
      title={<OverviewTitle session={session} />}
      actions={<OverviewHeaderActions session={session} hasNextLead={hasNextLead} />}
      headerRhythm="section"
      animationClassName="animate-fade-in"
    >
      <HeaderBand session={session} />
      {isArchived ? null : <OverviewNotices session={session} />}
      {isArchived ? null : <UnassignedNotes sessionId={sessionId} />}
      {isArchived ? null : <FolderCard sessionId={sessionId} />}
      <WorkTimeProvider sessionId={sessionId} workspaceId={session.workspaceId}>
        <CentralColumn session={session} onLeadChange={onLeadChange} />
      </WorkTimeProvider>
    </PaneShell>
  );
};
