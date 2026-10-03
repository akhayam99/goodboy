import { useEffect } from 'react';
import { Band } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { resolveStorageScope } from '../../resolveStorageScope';
import { ArtifactSection } from './ArtifactSection';
import { StorageHistory } from './StorageHistory';
import { StorageSummary } from './StorageSummary';
import { WorktreeSection } from './WorktreeSection';

export const StoragePage = () => {
  const loadStorage = useAppStore((state) => state.loadStorage);
  const reportError = useAppStore((state) => state.reportError);
  const storedScope = useAppStore((state) => state.storageScope);
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId);
  const setStorageScope = useAppStore((state) => state.setStorageScope);
  const scope = resolveStorageScope({ storedScope, currentWorkspaceId });

  useEffect(() => {
    void loadStorage().catch((error: unknown) =>
      reportError({ title: "Couldn't read storage usage", error }),
    );
  }, [loadStorage, reportError]);

  return (
    <div className="flex flex-col gap-8">
      <Band inset="content">
        <StorageSummary scope={scope} onScopeToAll={() => setStorageScope({ kind: 'all' })} />
      </Band>
      <WorktreeSection scope={scope} />
      <ArtifactSection scope={scope} />
      <StorageHistory />
    </div>
  );
};
