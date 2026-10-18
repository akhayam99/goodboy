import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { resolveStorageScope } from '../../resolveStorageScope';
import { ArtifactSection } from './ArtifactSection';
import { OtherToolsSection } from './OtherToolsSection';
import { StorageHistory } from './StorageHistory';
import { WorktreeSection } from './WorktreeSection';

export const StoragePage = () => {
  const loadStorage = useAppStore((state) => state.loadStorage);
  const reportError = useAppStore((state) => state.reportError);
  const storedScope = useAppStore((state) => state.storageScope);
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId);
  const scope = resolveStorageScope({ storedScope, currentWorkspaceId });

  useEffect(() => {
    void loadStorage().catch((error: unknown) =>
      reportError({ title: "Couldn't read storage usage", error }),
    );
  }, [loadStorage, reportError]);

  return (
    <div className="flex flex-col gap-8">
      <WorktreeSection scope={scope} />
      <ArtifactSection scope={scope} />
      <StorageHistory />
      <OtherToolsSection />
    </div>
  );
};
