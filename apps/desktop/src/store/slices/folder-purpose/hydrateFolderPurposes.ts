import type { FolderPurpose, ProjectId } from '@goodboy/types';
import { listProjectValues } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { parseFolderPurpose } from './parseFolderPurpose';
import { FOLDER_PURPOSE_QUEUE_KEY } from './storeFolderPurpose';
import type { FolderPurposeDeps } from './types';

export const hydrateFolderPurposes = ({ set, queue }: FolderPurposeDeps) => {
  return (): Promise<void> =>
    queue.run({
      key: FOLDER_PURPOSE_QUEUE_KEY,
      task: async () => {
        const rows = await listProjectValues({ db: tauriDatabase, key: 'folder.purpose' });
        const loaded: Record<ProjectId, FolderPurpose> = {};
        for (const row of rows) {
          const purpose = parseFolderPurpose({ raw: row.value });
          if (purpose !== null) {
            loaded[row.projectId] = purpose;
          }
        }
        set({ folderPurpose: loaded });
      },
    });
};
