import { PaneShell } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { WorkTimeProvider } from '../../../workTreeModel/WorkTimeProvider';
import { CentralColumn } from './CentralColumn';
import { GoalTeaser } from './GoalTeaser';
import { OverviewTitle } from './OverviewTitle';
import { OverviewHeaderActions } from './OverviewHeaderActions';
import { SessionDropPill } from './SessionDropPill';
import { TaskDragLayer } from './TaskDragLayer';

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
    <div className="flex min-w-0 flex-col gap-1">
      <GoalTeaser session={session} />
      <SessionDropPill />
      <TaskDragLayer />
    </div>
    <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
      <CentralColumn session={session} />
    </WorkTimeProvider>
  </PaneShell>
);
