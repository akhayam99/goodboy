import type { Session } from '@goodboy/types';
import { SummaryStateLine } from '../../central/summary/SummaryStateLine';
import { ChatOriginRow } from './ChatOriginRow';
import { GoalTeaser } from './GoalTeaser';
import { SessionDropPill } from './SessionDropPill';
import { TaskDragLayer } from './TaskDragLayer';

type Props = {
  readonly session: Session;
};

export const HeaderBand = ({ session }: Props) => (
  <div className="flex min-w-0 flex-col gap-1">
    <GoalTeaser session={session} />
    {session.archivedAt == null ? <SummaryStateLine sessionId={session.id} /> : null}
    <ChatOriginRow session={session} />
    <SessionDropPill />
    <TaskDragLayer />
  </div>
);
