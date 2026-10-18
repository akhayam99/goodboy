import type { FolderPurpose } from '@goodboy/types';
import { getSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { folderPurposeKey, parseFolderPurpose } from './folderPurposeKey';
import { FOLDER_PURPOSE_QUEUE_KEY, storeFolderPurpose } from './storeFolderPurpose';
import type { FolderPurposeDeps, LoadFolderPurposeParams } from './types';

export const loadFolderPurpose = ({ set, queue }: FolderPurposeDeps) => {
  return ({ projectId }: LoadFolderPurposeParams): Promise<FolderPurpose | null> =>
    queue.run({
      key: FOLDER_PURPOSE_QUEUE_KEY,
      task: async () => {
        const raw = await getSetting(tauriDatabase, folderPurposeKey({ projectId }));
        const purpose = parseFolderPurpose({ raw });
        storeFolderPurpose({ set, projectId, purpose });
        return purpose;
      },
    });
};
