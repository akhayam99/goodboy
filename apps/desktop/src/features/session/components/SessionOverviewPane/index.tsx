import { PaneShell } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { WorkTimeProvider } from '../../../workTreeModel/WorkTimeProvider';
import { CentralColumn } from './CentralColumn';
import { HeaderBand } from './HeaderBand';
import { OverviewTitle } from './OverviewTitle';
import { OverviewHeaderActions } from './OverviewHeaderActions';

type Props = {
  readonly session: Session;
};

export const SessionOverviewPane = ({ session }: Props) => (
  <PaneShell
    page="overview"
    title={<OverviewTitle session={session} />}
    actions={<OverviewHeaderActions session={session} />}
    headerRhythm="section"
    animationClassName="animate-fade-in"
  >
    <HeaderBand session={session} />
    <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
      <CentralColumn session={session} />
    </WorkTimeProvider>
  </PaneShell>
);
