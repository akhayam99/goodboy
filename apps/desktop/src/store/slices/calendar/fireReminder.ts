import { fireReminder as storeReminderFire, readReminder } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  commitAfterConfirm,
  type CommitResult,
} from '../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../slice-types';
import { calendarWrites } from './calendarWrites';
import { replaceReminder } from './replaceReminder';
import type { FireReminderParams } from './types';

const NOT_WAITING = 'This reminder is done or gone.';

export const fireReminder = ({ set, get }: SliceDeps) => {
  return async ({
    workspaceId,
    reminderId,
    firedAt,
  }: FireReminderParams): Promise<CommitResult<number>> => {
    calendarWrites.loads.cancel({ key: calendarWrites.remindersKey({ workspaceId }) });
    const result = await commitAfterConfirm({
      get,
      failureTitle: "Couldn't bring the reminder to Needs you",
      target: { workspaceId },
      step: async () => {
        const isFired = await storeReminderFire({
          db: tauriDatabase,
          workspaceId,
          reminderId,
          firedAt,
        });
        if (isFired) {
          return firedAt;
        }
        const stored = await readReminder({ db: tauriDatabase, workspaceId, reminderId });
        if (stored === null || stored.doneAt !== null || stored.dueAt === null) {
          throw new Error(NOT_WAITING);
        }
        return stored.dueAt;
      },
      commit: () => undefined,
    });
    if (result.isOk) {
      replaceReminder({ set, workspaceId, reminderId, patch: { dueAt: result.value } });
    }
    return result;
  };
};
