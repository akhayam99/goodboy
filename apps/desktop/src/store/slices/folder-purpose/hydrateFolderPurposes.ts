import type { FolderPurpose, ProjectId } from '@goodboy/types';
import { listSettingsWithPrefix } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { folderPurposePrefix, parseFolderPurpose, projectIdOfPurposeKey } from './folderPurposeKey';
import { FOLDER_PURPOSE_QUEUE_KEY } from './storeFolderPurpose';
import type { FolderPurposeDeps } from './types';

export const hydrateFolderPurposes = ({ set, queue }: FolderPurposeDeps) => {
  return (): Promise<void> =>
    queue.run({
      key: FOLDER_PURPOSE_QUEUE_KEY,
      task: async () => {
        const rows = await listSettingsWithPrefix(tauriDatabase, folderPurposePrefix());
        const loaded: Record<ProjectId, FolderPurpose> = {};
        for (const row of rows) {
          const projectId = projectIdOfPurposeKey({ key: row.key });
          const purpose = parseFolderPurpose({ raw: row.value });
          if (projectId !== null && purpose !== null) {
            loaded[projectId] = purpose;
          }
        }
        set({ folderPurpose: loaded });
      },
    });
};
