import { PaneShell } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { WorkTimeProvider } from '../../../workTreeModel/WorkTimeProvider';
import { CentralColumn } from './CentralColumn';
import { GoalTeaser } from './GoalTeaser';
import { SessionDropPill } from './SessionDropPill';
import { TaskDragLayer } from './TaskDragLayer';

type Props = {
  readonly session: Session;
};

export const SessionOverviewPane = ({ session }: Props) => (
  <PaneShell page="overview" animationClassName="animate-fade-in">
    <div className="flex min-w-0 flex-col gap-1 empty:hidden">
      <GoalTeaser session={session} />
      <SessionDropPill />
    </div>
    <TaskDragLayer />
    <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
      <CentralColumn session={session} />
    </WorkTimeProvider>
  </PaneShell>
);
