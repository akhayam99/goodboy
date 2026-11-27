import type { MountId, Reminder, SessionId, WorkspaceId } from '@goodboy/types';
import { pullRequestReminderIdOf } from './pullRequestReminderIdOf';

type Params = {
  readonly reminders: Readonly<Record<WorkspaceId, ReadonlyArray<Reminder>>>;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly prNumber: number;
};

export const isWaitingForGreen = ({ reminders, sessionId, mountId, prNumber }: Params): boolean => {
  const id = pullRequestReminderIdOf({ sessionId, mountId, prNumber });
  return Object.values(reminders).some((list) =>
    list.some(
      (reminder) =>
        reminder.trigger === 'ci_green' &&
        reminder.doneAt === null &&
        reminder.target?.kind === 'pull_request' &&
        reminder.target.id === id,
    ),
  );
};
