import type { SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

type FailureParams = {
  readonly failed: number;
  readonly total: number;
};

const failureMessage = ({ failed, total }: FailureParams): string =>
  total === 1
    ? 'failed to archive the session'
    : `failed to archive ${failed} of ${total} sessions`;

export const bulkArchiveTask = (set: SetFn, get: GetFn) => {
  return async (ids: ReadonlyArray<SessionId>) => {
    const failures: SessionId[] = [];
    for (const id of ids) {
      try {
        await get().archiveTask(id);
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
