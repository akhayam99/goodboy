import { useAppStore, useWorkspaces } from '../../../store';
import { resolveStorageScope } from '../resolveStorageScope';
import { storageMetaOf } from '../storageMetaOf';
import { storageTotalBytes } from '../storageTotalBytes';
import { useStorageSummary } from '../useStorageSummary';

export const useStorageMeta = (): string | undefined => {
  const stats = useAppStore((state) => state.storageStats);
  const artifacts = useAppStore((state) => state.storageArtifacts);
  const storedScope = useAppStore((state) => state.storageScope);
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId);
  const workspaces = useWorkspaces();
  const scope = resolveStorageScope({ storedScope, currentWorkspaceId });
  const { summary } = useStorageSummary({ scope });
  if (stats === null) {
    return undefined;
  }
  const workspaceName =
    scope.kind === 'workspace'
      ? (workspaces.find((workspace) => workspace.id === scope.id)?.name ?? null)
      : null;
  return storageMetaOf({
    totalBytes: storageTotalBytes({
      stats,
      artifacts,
      summary,
      isScoped: scope.kind !== 'all',
    }),
    workspaceName,
    isAllScope: scope.kind === 'all',
    freeBytes: stats.diskFreeBytes,
  });
};
