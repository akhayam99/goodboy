import type { SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

type FailureParams = {
  readonly failed: number;
  readonly total: number;
};

const failureMessage = ({ failed, total }: FailureParams): string =>
  total === 1
    ? 'failed to restore the session'
    : `failed to restore ${failed} of ${total} sessions`;

export const bulkUnarchiveTask = (set: SetFn, get: GetFn) => {
  return async (ids: ReadonlyArray<SessionId>) => {
    const failures: SessionId[] = [];
    for (const id of ids) {
      try {
        await get().unarchiveTask(id);
      } catch {
        failures.push(id);
      }
    }
    if (failures.length > 0) {
      void get().emitNotification(
        'error',
        'warning',
        failureMessage({ failed: failures.length, total: ids.length }),
      );
    }
  };
};
