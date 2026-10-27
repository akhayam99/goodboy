import type { Project } from '@goodboy/types';
import { fileVersionsFolderSize } from '../../../features/file-versions/fileVersions';
import { folderHistorySize } from '../../../features/file-versions/folderHistorySize';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';

type Params = Readonly<{
  folder: Project;
}>;

const latest = createLatestOnly();

export const loadFolderHistorySize = ({ set }: SliceDeps) => {
  return async ({ folder }: Params): Promise<void> => {
    await latest.run({
      key: folder.id,
      request: () => fileVersionsFolderSize({ folderPath: folder.rootPath }),
      apply: (size) => {
        set((state) => ({
          folderHistorySizes: {
            ...state.folderHistorySizes,
            [folder.id]: folderHistorySize({ size }),
          },
        }));
      },
    });
  };
};
