import type { Reminder } from '@goodboy/types';
import { isReminderDue } from './isReminderDue';

type Params = {
  readonly reminders: ReadonlyArray<Reminder>;
  readonly now: number;
};

type DueParams = {
  readonly reminder: Reminder;
};

const dueSinceOf = ({ reminder }: DueParams): number =>
  Math.max(reminder.dueAt ?? 0, reminder.snoozedUntil ?? 0);

export const dueRemindersOf = ({ reminders, now }: Params): ReadonlyArray<Reminder> =>
  reminders
    .filter((reminder) => isReminderDue({ reminder, now }))
    .sort((left, right) => {
      const gap = dueSinceOf({ reminder: left }) - dueSinceOf({ reminder: right });
      return gap === 0 ? left.id.localeCompare(right.id) : gap;
    });
