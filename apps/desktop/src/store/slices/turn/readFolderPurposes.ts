import type { FolderPurpose, Project, ProjectId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = Readonly<{
  get: GetFn;
  folders: ReadonlyArray<Project>;
}>;

export const readFolderPurposes = async ({
  get,
  folders,
}: Params): Promise<Readonly<Record<ProjectId, FolderPurpose>>> => {
  const entries = await Promise.all(
    folders.map(async (folder) => {
      const purpose = await get()
        .loadFolderPurpose({ projectId: folder.id })
        .catch(() => get().folderPurpose[folder.id] ?? null);
      return purpose === null ? [] : [[folder.id, purpose] as const];
    }),
  );
  return Object.fromEntries(entries.flat());
};
