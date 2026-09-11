import type { SessionId } from '@goodboy/types';
import type { BulkSessionResult, GetFn, SetFn } from './types';

type FailureParams = {
  readonly failed: number;
  readonly total: number;
};

const failureMessage = ({ failed, total }: FailureParams): string =>
  total === 1
    ? 'failed to restore the session'
    : `failed to restore ${failed} of ${total} sessions`;

export const bulkUnarchiveTask = (set: SetFn, get: GetFn) => {
  return async (ids: ReadonlyArray<SessionId>): Promise<BulkSessionResult> => {
    const succeeded: SessionId[] = [];
    const failed: SessionId[] = [];
    for (const id of ids) {
      try {
        await get().unarchiveTask(id);
        succeeded.push(id);
      } catch {
        failed.push(id);
      }
    }
    if (failed.length > 0) {
      void get().emitNotification(
        'error',
        'warning',
        failureMessage({ failed: failed.length, total: ids.length }),
      );
    }
    return { succeeded, failed };
  };
};
