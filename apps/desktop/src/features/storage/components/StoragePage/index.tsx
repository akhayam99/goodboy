import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { ArtifactSection } from './ArtifactSection';
import { StorageCleanupSettings } from './StorageCleanupSettings';
import { StorageHistory } from './StorageHistory';
import { StorageSummary } from './StorageSummary';
import { WorktreeSection } from './WorktreeSection';

export const StoragePage = () => {
  const loadStorage = useAppStore((state) => state.loadStorage);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    void loadStorage().catch((error: unknown) =>
      reportError({ title: "Couldn't read storage usage", error }),
    );
  }, [loadStorage, reportError]);

  return (
    <div className="flex flex-col gap-8">
      <StorageSummary />
      <WorktreeSection />
      <ArtifactSection />
      <StorageHistory />
      <StorageCleanupSettings />
    </div>
  );
};
