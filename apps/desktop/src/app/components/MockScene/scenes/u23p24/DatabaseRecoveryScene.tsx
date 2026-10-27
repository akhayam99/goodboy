import { useEffect } from 'react';
import { DatabaseRecovery } from '../../../BootSplash/DatabaseRecovery';
import { DATABASE_UNAVAILABLE_MESSAGE } from '../../../../../shared/lib/db';
import { useAppStore } from '../../../../../store';

const keepWaiting = (): Promise<void> => new Promise<void>(() => undefined);

export const DatabaseRecoveryScene = () => {
  useEffect(() => {
    useAppStore.setState({ retryDatabaseOpen: keepWaiting, moveDatabaseAside: keepWaiting });
  }, []);
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <DatabaseRecovery error={DATABASE_UNAVAILABLE_MESSAGE} />
    </div>
  );
};
