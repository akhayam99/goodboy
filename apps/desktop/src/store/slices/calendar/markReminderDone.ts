import { markReminderDone as storeReminderDone, readReminder, reopenReminder } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  commitAfterConfirm,
  type CommitResult,
} from '../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../slice-types';
import { calendarWrites } from './calendarWrites';
import { replaceReminder } from './replaceReminder';
import type { ReminderParams } from './types';

const GONE = 'This reminder is gone.';

export const markReminderDone = ({ set, get }: SliceDeps) => {
  return async ({ workspaceId, reminderId }: ReminderParams): Promise<CommitResult<number>> => {
    calendarWrites.loads.cancel({ key: calendarWrites.remindersKey({ workspaceId }) });
    const result = await commitAfterConfirm({
      get,
      failureTitle: "Couldn't mark the reminder done",
      target: { workspaceId },
      step: async () => {
        const doneAt = Date.now();
        const isMarked = await storeReminderDone({
          db: tauriDatabase,
          workspaceId,
          reminderId,
          doneAt,
        });
        if (isMarked) {
          return doneAt;
        }
        const stored = await readReminder({ db: tauriDatabase, workspaceId, reminderId });
        if (stored?.doneAt == null) {
          throw new Error(GONE);
        }
        return stored.doneAt;
      },
      commit: () => undefined,
    });
    if (!result.isOk) {
      return result;
    }
    const doneAt = result.value;
    replaceReminder({ set, workspaceId, reminderId, patch: { doneAt } });
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
