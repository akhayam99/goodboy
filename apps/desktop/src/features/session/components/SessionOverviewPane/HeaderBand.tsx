import type { Session } from '@goodboy/types';
import { ChatOriginRow } from './ChatOriginRow';
import { GoalTeaser } from './GoalTeaser';
import { SessionDropPill } from './SessionDropPill';
import { TaskDragLayer } from './TaskDragLayer';

type Props = {
  readonly session: Session;
};

export const HeaderBand = ({ session }: Props) => (
  <div className="flex min-w-0 flex-col gap-2">
    <ChatOriginRow session={session} />
    <GoalTeaser session={session} />
    <SessionDropPill />
    <TaskDragLayer />
  </div>
);
