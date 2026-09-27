import { useEffect } from 'react';
import { GitBranch, HardDrive } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { resolveStorageScope } from '../../resolveStorageScope';
import { AfterMergeRuleLine } from './AfterMergeRuleLine';
import { ArtifactSection } from './ArtifactSection';
import { StorageCleanupSettings } from './StorageCleanupSettings';
import { StorageCluster } from './StorageCluster';
import { StorageHistory } from './StorageHistory';
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
    <div className="flex flex-col gap-12">
      <StorageCluster
        id="storage-space"
        title="Free up space"
        hint="Worktree folders, artifact copies and archived history, with their sizes."
        icon={HardDrive}
        tone="primary"
      >
        <StorageSummary scope={scope} onScopeToAll={() => setStorageScope({ kind: 'all' })} />
        <WorktreeSection scope={scope} />
        <ArtifactSection scope={scope} />
        <StorageHistory />
        <StorageCleanupSettings />
      </StorageCluster>
      <StorageCluster
        id="storage-branch-cleanup"
        title="Clean up branches"
        hint="Merged and stale local branches, and what happens to a branch after its merge."
        icon={GitBranch}
        tone="merged"
      >
        <BranchesSection scope={scope} />
        {scope.kind === 'workspace' ? <AfterMergeRuleLine workspaceId={scope.id} /> : null}
      </StorageCluster>
    </div>
  );
};
