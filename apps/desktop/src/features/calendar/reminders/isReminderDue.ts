import type { Reminder } from '@goodboy/types';

type Params = {
  readonly reminder: Reminder;
  readonly now: number;
};

export const isReminderDue = ({ reminder, now }: Params): boolean => {
  if (reminder.doneAt !== null || reminder.dueAt === null || reminder.dueAt > now) {
    return false;
  }
  return reminder.snoozedUntil === null || reminder.snoozedUntil <= now;
};
