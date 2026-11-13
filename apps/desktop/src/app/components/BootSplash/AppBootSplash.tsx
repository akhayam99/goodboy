import { useAppStore } from '../../../store';
import { BootSplash } from './index';

export const AppBootSplash = () => {
  const phase = useAppStore((s) => s.bootPhase);
  const failedPhase = useAppStore((s) => s.bootFailedPhase);
  const error = useAppStore((s) => s.error);
  const newerDatabase = useAppStore((s) => s.newerDatabase);
  const retryHydrate = useAppStore((s) => s.retryHydrate);
  const restoreNewerDatabaseBackup = useAppStore((s) => s.restoreNewerDatabaseBackup);
  const quitApp = useAppStore((s) => s.quitApp);
  return (
    <BootSplash
      phase={phase}
      failedPhase={failedPhase}
      error={error}
      newerDatabase={newerDatabase}
      onRetry={retryHydrate}
      onRestoreBackup={restoreNewerDatabaseBackup}
      onQuit={() => void quitApp()}
    />
  );
};
