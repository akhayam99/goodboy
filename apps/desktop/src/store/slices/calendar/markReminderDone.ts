import { markReminderDone as storeReminderDone, reopenReminder } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  commitAfterConfirm,
  type CommitResult,
} from '../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../slice-types';
import { calendarWrites } from './calendarWrites';
import { replaceReminder } from './replaceReminder';
import type { ReminderParams } from './types';

const ALREADY_DONE = 'This reminder is already done or gone.';

export const markReminderDone = ({ set, get }: SliceDeps) => {
  return async ({ workspaceId, reminderId }: ReminderParams): Promise<CommitResult<number>> => {
    const doneAt = Date.now();
    calendarWrites.loads.cancel({ key: calendarWrites.remindersKey({ workspaceId }) });
    const result = await commitAfterConfirm({
      get,
      failureTitle: "Couldn't mark the reminder done",
      target: { workspaceId },
      step: async () => {
        const isMarked = await storeReminderDone({
          db: tauriDatabase,
          workspaceId,
          reminderId,
          doneAt,
        });
        if (!isMarked) {
          throw new Error(ALREADY_DONE);
        }
        return doneAt;
      },
      commit: () => {
        replaceReminder({ set, workspaceId, reminderId, patch: { doneAt } });
      },
    });
    if (!result.isOk) {
      return result;
    }
    get().undoable({
      message: 'Reminder done',
      conflictMessage: 'This reminder changed. Nothing changed.',
      undo: async () => {
        const isReopened = await reopenReminder({
          db: tauriDatabase,
          workspaceId,
          reminderId,
          doneAt,
        });
        if (isReopened) {
          replaceReminder({ set, workspaceId, reminderId, patch: { doneAt: null } });
        }
        return isReopened;
      },
    });
    return result;
  };
};
