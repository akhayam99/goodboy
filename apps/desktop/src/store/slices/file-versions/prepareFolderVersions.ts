import type { Project } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { fileVersionsFolderPrepare } from '../../../features/file-versions/fileVersions';
import type { SliceDeps } from '../../slice-types';
import type { FolderVersionsStatus } from './state';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  folder: Project;
}>;

type ApplyParams = Readonly<{
  set: SetFn;
  get: GetFn;
  folder: Project;
  next: FolderVersionsStatus;
}>;

const applyIfStillLinked = ({ set, get, folder, next }: ApplyParams): void => {
  const isLinked = get().projects.some(
    (project) => project.id === folder.id && project.rootPath === folder.rootPath,
  );
  if (!isLinked) {
    return;
  }
  set((state) => ({
    folderVersionsStatus: { ...state.folderVersionsStatus, [folder.id]: next },
  }));
};

export const prepareFolderVersions = ({ set, get }: SliceDeps) => {
  return async ({ folder }: Params): Promise<void> => {
    if (folder.kind !== 'folder') {
      return;
    }
    set((state) => ({
      folderVersionsStatus: { ...state.folderVersionsStatus, [folder.id]: { kind: 'building' } },
    }));
    try {
      const status = await fileVersionsFolderPrepare({
        folderPath: folder.rootPath,
        folderId: folder.id,
      });
      applyIfStillLinked({ set, get, folder, next: { kind: 'ready', status } });
    } catch (error) {
      applyIfStillLinked({
        set,
        get,
        folder,
        next: { kind: 'failed', message: formatError(error) },
      });
      throw error;
    }
  };
};
