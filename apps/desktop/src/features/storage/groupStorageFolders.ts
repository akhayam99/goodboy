import type { WorkspaceId } from '@goodboy/types';
import { storageFolderBucket } from '../../store/slices/storage/classifyStorageFolder';
import type { StorageFilter, StorageFolder, StorageRoot } from '../../store/slices/storage/types';

export type StorageFolderGroup = {
  readonly root: StorageRoot;
  readonly folders: ReadonlyArray<StorageFolder>;
  readonly bytes: number;
};

type Params = {
  readonly folders: ReadonlyArray<StorageFolder>;
  readonly roots: ReadonlyArray<StorageRoot>;
  readonly filter: StorageFilter;
  readonly workspaceId: WorkspaceId | null;
  readonly now: number;
};

const fallbackRoot = (repoRoot: string): StorageRoot => ({
  repoRoot,
  projectName:
    repoRoot
      .split('/')
      .filter((part) => part !== '')
      .at(-1) ?? repoRoot,
  workspaceId: null,
  workspaceName: null,
  isDisconnected: false,
});

const sizeOf = (folder: StorageFolder): number => folder.sizeBytes ?? 0;

export const groupStorageFolders = ({
  folders,
  roots,
  filter,
  workspaceId,
  now,
}: Params): ReadonlyArray<StorageFolderGroup> => {
  const rootByPath = new Map(roots.map((root) => [root.repoRoot, root]));
  const grouped = new Map<string, Array<StorageFolder>>();
  for (const folder of folders) {
    if (storageFolderBucket({ folder, now }) !== filter) {
      continue;
    }
    const root = rootByPath.get(folder.repoRoot);
    const ownerWorkspace = folder.workspaceId ?? root?.workspaceId ?? null;
    if (workspaceId !== null && ownerWorkspace !== workspaceId) {
      continue;
    }
    grouped.set(folder.repoRoot, [...(grouped.get(folder.repoRoot) ?? []), folder]);
  }
  return [...grouped.entries()]
    .map(([repoRoot, members]) => ({
      root: rootByPath.get(repoRoot) ?? fallbackRoot(repoRoot),
      folders: [...members].sort((a, b) => sizeOf(b) - sizeOf(a)),
      bytes: members.reduce((sum, folder) => sum + sizeOf(folder), 0),
    }))
    .sort((a, b) => b.bytes - a.bytes || a.root.projectName.localeCompare(b.root.projectName));
};
