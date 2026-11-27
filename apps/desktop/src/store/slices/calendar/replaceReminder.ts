import type { Reminder, ReminderId, WorkspaceId } from '@goodboy/types';
import type { SetFn } from '../../slice-types';
import { sortReminders } from './sortReminders';

type ReminderPatch = Partial<Pick<Reminder, 'doneAt' | 'snoozedUntil'>>;

type Params = {
  readonly set: SetFn;
  readonly workspaceId: WorkspaceId;
  readonly reminderId: ReminderId;
  readonly patch: ReminderPatch;
};

export const replaceReminder = ({ set, workspaceId, reminderId, patch }: Params): void => {
  set((state) => {
    const reminders = state.calendarReminders[workspaceId];
    if (reminders === undefined) {
      return {};
    }
    return {
      calendarReminders: {
        ...state.calendarReminders,
        [workspaceId]: sortReminders({
          reminders: reminders.map((reminder) =>
            reminder.id === reminderId ? { ...reminder, ...patch } : reminder,
          ),
        }),
      },
    };
  });
};
