import { insertReminder } from '@goodboy/db';
import { brandId, type Reminder, type ReminderId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  commitAfterConfirm,
  type CommitResult,
} from '../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../slice-types';
import { calendarWrites } from './calendarWrites';
import { sortReminders } from './sortReminders';
import type { AddReminderParams } from './types';

const EMPTY_TEXT = 'Write what to remind you of.';

export const addReminder = ({ set, get }: SliceDeps) => {
  return ({
    workspaceId,
    text,
    trigger,
    dueAt,
    target,
  }: AddReminderParams): Promise<CommitResult<Reminder>> => {
    const trimmed = text.trim();
    if (trimmed === '') {
      return Promise.resolve({ isOk: false, error: new Error(EMPTY_TEXT) });
    }
    const reminder: Reminder = {
      id: brandId<ReminderId>({ value: crypto.randomUUID() }),
      workspaceId,
      text: trimmed,
      trigger,
      dueAt,
      target,
      snoozedUntil: null,
      doneAt: null,
      createdAt: Date.now(),
    };
    calendarWrites.loads.cancel({ key: calendarWrites.remindersKey({ workspaceId }) });
    return commitAfterConfirm({
      get,
      failureTitle: "Couldn't add the reminder",
      target: { workspaceId },
      step: async () => {
        await insertReminder({ db: tauriDatabase, reminder });
        return reminder;
      },
      commit: () => {
        set((state) => ({
          calendarReminders: {
            ...state.calendarReminders,
            [workspaceId]: sortReminders({
              reminders: [...(state.calendarReminders[workspaceId] ?? []), reminder],
            }),
          },
        }));
      },
    });
  };
};
