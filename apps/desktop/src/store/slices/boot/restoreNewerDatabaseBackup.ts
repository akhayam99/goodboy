import { restoreMigrationSnapshot } from '../../../shared/lib/db';
import type { GetFn } from './types';

export const restoreNewerDatabaseBackup = (get: GetFn) => {
  return async (): Promise<void> => {
    const path = get().newerDatabase?.restorableSnapshot ?? null;
    if (path === null) {
      return;
    }
    await restoreMigrationSnapshot({ path });
    await get().retryHydrate();
  };
};
