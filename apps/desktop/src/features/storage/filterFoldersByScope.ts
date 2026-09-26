import type { StorageFolder, StorageRoot, StorageScope } from '../../store/slices/storage/types';
import { storageOwnerMatchesScope } from './storageOwnerMatchesScope';

type Params = {
  readonly folders: ReadonlyArray<StorageFolder>;
  readonly roots: ReadonlyArray<StorageRoot>;
  readonly scope: StorageScope;
};

export const filterFoldersByScope = ({
  folders,
  roots,
  scope,
}: Params): ReadonlyArray<StorageFolder> => {
  if (scope.kind === 'all') {
    return folders;
  }
  const rootByPath = new Map(roots.map((root) => [root.repoRoot, root]));
  return folders.filter((folder) => {
    const root = rootByPath.get(folder.repoRoot);
    const ownerWorkspace = folder.workspaceId ?? root?.workspaceId ?? null;
    return storageOwnerMatchesScope({ ownerWorkspace, scope });
  });
};
