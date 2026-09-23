import type { SessionId } from '@goodboy/types';
import type { BulkSessionResult, GetFn, SetFn } from './types';

type FailureParams = {
  readonly failed: number;
  readonly total: number;
};

const failureMessage = ({ failed, total }: FailureParams): string =>
  total === 1 ? "Couldn't archive the session" : `Couldn't archive ${failed} of ${total} sessions`;

export const bulkArchiveTask = (set: SetFn, get: GetFn) => {
  return async (ids: ReadonlyArray<SessionId>): Promise<BulkSessionResult> => {
    const succeeded: SessionId[] = [];
    const failed: SessionId[] = [];
    for (const id of ids) {
      try {
        await get().archiveTask(id);
        succeeded.push(id);
      } catch {
        failed.push(id);
      }
    }
    if (failed.length > 0) {
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: failureMessage({ failed: failed.length, total: ids.length }),
      });
    }
    return { succeeded, failed };
  };
};
