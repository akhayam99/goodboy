import type { Project } from '@goodboy/types';
import { fileVersionsFolderForget } from '../../../features/file-versions/fileVersions';
import type { SliceDeps } from '../../slice-types';

type Params = Readonly<{
  folder: Project;
}>;

export const forgetFolderVersions = ({ set }: SliceDeps) => {
  return async ({ folder }: Params): Promise<void> => {
    await fileVersionsFolderForget({ folderPath: folder.rootPath });
    set((state) => {
      const rest = { ...state.folderVersionsStatus };
      delete rest[folder.id];
      return { folderVersionsStatus: rest };
    });
  };
};
