import { snoozeReminder as storeReminderSnooze } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  commitAfterConfirm,
  type CommitResult,
} from '../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../slice-types';
import { calendarWrites } from './calendarWrites';
import { replaceReminder } from './replaceReminder';
import type { SnoozeReminderParams } from './types';

const NOT_OPEN = 'This reminder is done or gone.';

export const snoozeReminder = ({ set, get }: SliceDeps) => {
  return ({
    workspaceId,
    reminderId,
    snoozedUntil,
  }: SnoozeReminderParams): Promise<CommitResult<number>> => {
    calendarWrites.loads.cancel({ key: calendarWrites.remindersKey({ workspaceId }) });
    return commitAfterConfirm({
      get,
      failureTitle: "Couldn't snooze the reminder",
      target: { workspaceId },
      step: async () => {
        const isSnoozed = await storeReminderSnooze({
          db: tauriDatabase,
          workspaceId,
          reminderId,
          snoozedUntil,
        });
        if (!isSnoozed) {
          throw new Error(NOT_OPEN);
        }
        return snoozedUntil;
      },
      commit: () => {
        replaceReminder({ set, workspaceId, reminderId, patch: { snoozedUntil } });
      },
    });
  };
};
