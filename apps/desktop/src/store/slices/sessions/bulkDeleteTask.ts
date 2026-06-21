import type { SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

export const bulkDeleteTask = (set: SetFn, get: GetFn) => {
  return async (ids: ReadonlyArray<SessionId>) => {
    const failures: SessionId[] = [];
    for (const id of ids) {
      try {
        await get().deleteTask(id);
      } catch {
        failures.push(id);
      }
    }
    if (failures.length > 0) {
      void get().emitNotification(
        'error',
        'warning',
        `failed to delete ${failures.length} of ${ids.length} sessions`,
      );
    }
  };
};
