import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { resolveStorageScope } from '../../resolveStorageScope';
import { ArtifactSection } from './ArtifactSection';
import { StorageCleanupSettings } from './StorageCleanupSettings';
import { StorageHistory } from './StorageHistory';
import { StorageScopePicker } from './StorageScopePicker';
import { StorageSummary } from './StorageSummary';
import { WorktreeSection } from './WorktreeSection';
import { BranchesSection } from '../BranchesSection';

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
      <div className="flex items-center justify-end">
        <StorageScopePicker scope={scope} onChange={setStorageScope} />
      </div>
      <StorageSummary scope={scope} onScopeToAll={() => setStorageScope({ kind: 'all' })} />
      <WorktreeSection scope={scope} />
      <BranchesSection scope={scope} />
      <ArtifactSection scope={scope} />
      <StorageHistory />
      <StorageCleanupSettings />
    </div>
  );
};
