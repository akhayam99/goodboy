import type { WorkspaceId } from '@goodboy/types';
import type { StorageFolder, StorageRoot } from '../../store/slices/storage/types';

type Params = {
  readonly folders: ReadonlyArray<StorageFolder>;
  readonly roots: ReadonlyArray<StorageRoot>;
};

export type StorageWeightByScope = {
  readonly byWorkspace: ReadonlyMap<WorkspaceId, number>;
  readonly removedBytes: number;
};

export const storageWeightByScope = ({ folders, roots }: Params): StorageWeightByScope => {
  const rootByPath = new Map(roots.map((root) => [root.repoRoot, root]));
  const byWorkspace = new Map<WorkspaceId, number>();
  let removedBytes = 0;
  for (const folder of folders) {
    const root = rootByPath.get(folder.repoRoot);
    const ownerWorkspace = folder.workspaceId ?? root?.workspaceId ?? null;
    const bytes = folder.sizeBytes ?? 0;
    if (ownerWorkspace === null) {
      removedBytes += bytes;
      continue;
    }
    byWorkspace.set(ownerWorkspace, (byWorkspace.get(ownerWorkspace) ?? 0) + bytes);
  }
  return { byWorkspace, removedBytes };
};
