import type { SessionId } from '@goodboy/types';
import type { BulkSessionResult, GetFn, SetFn } from './types';

type FailureParams = {
  readonly failed: number;
  readonly total: number;
};

const failureMessage = ({ failed, total }: FailureParams): string =>
  total === 1 ? "Couldn't restore the session" : `Couldn't restore ${failed} of ${total} sessions`;

export const bulkUnarchiveTask = (set: SetFn, get: GetFn) => {
  return async (ids: ReadonlyArray<SessionId>): Promise<BulkSessionResult> => {
    const succeeded: SessionId[] = [];
    const failed: SessionId[] = [];
    let firstError: unknown = null;
    for (const id of ids) {
      try {
        await get().unarchiveTask(id);
        succeeded.push(id);
      } catch (error) {
        failed.push(id);
        firstError = firstError ?? error;
      }
    }
    const onlyFailed = failed.length === 1 ? failed[0] : undefined;
    if (failed.length > 0) {
      void get().reportError({
        severity: 'warning',
        title: failureMessage({ failed: failed.length, total: ids.length }),
        error: firstError,
        ...(onlyFailed !== undefined && { sessionId: onlyFailed }),
      });
    }
    return { succeeded, failed };
  };
};
